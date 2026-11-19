-- Corrige definitivamente o escopo do administrador técnico da ANIT.
-- Idempotente: não exclui usuários, perfis, cadastros ou registros institucionais.

-- O administrador técnico recebe somente painel, diagnóstico e auditoria resumida.
UPDATE anit.role_permissions
   SET allowed = false
 WHERE role = 'administrator';

INSERT INTO anit.role_permissions(role, permission_key, allowed)
VALUES
  ('administrator', 'dashboard.read', true),
  ('administrator', 'system.read', true),
  ('administrator', 'audit.read', true),
  ('administrator', '*', false),
  ('administrator', 'users.read', false),
  ('administrator', 'users.manage', false)
ON CONFLICT (role, permission_key)
DO UPDATE SET allowed = EXCLUDED.allowed;

-- Reforça a regra no servidor: apenas os dois cargos estatutários têm acesso integral.
CREATE OR REPLACE FUNCTION anit.has_permission(p_permission_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = anit, public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_role text;
  v_override boolean;
  v_role_allowed boolean;
BEGIN
  IF v_user IS NULL OR p_permission_key IS NULL OR p_permission_key = '*' THEN
    RETURN false;
  END IF;

  SELECT role INTO v_role
    FROM anit.user_profiles
   WHERE user_id = v_user AND active = true;

  IF v_role IS NULL THEN RETURN false; END IF;
  IF v_role IN ('president', 'vice_president') THEN RETURN true; END IF;

  -- O perfil técnico não herda qualquer autorização institucional.
  IF v_role = 'administrator'
     AND p_permission_key NOT IN ('dashboard.read', 'system.read', 'audit.read') THEN
    RETURN false;
  END IF;

  SELECT allowed INTO v_override
    FROM anit.user_permissions
   WHERE user_id = v_user AND permission_key = p_permission_key;
  IF FOUND THEN RETURN v_override; END IF;

  SELECT allowed INTO v_role_allowed
    FROM anit.role_permissions
   WHERE role = v_role AND permission_key = p_permission_key;

  RETURN COALESCE(v_role_allowed, false);
END;
$$;

-- A lista efetiva do administrador técnico também fica limitada no servidor.
CREATE OR REPLACE FUNCTION anit.current_permissions()
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = anit, public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_role text;
  v_permissions text[];
BEGIN
  IF v_user IS NULL THEN RETURN ARRAY[]::text[]; END IF;

  SELECT role INTO v_role
    FROM anit.user_profiles
   WHERE user_id = v_user AND active = true;

  IF v_role IS NULL THEN RETURN ARRAY[]::text[]; END IF;

  IF v_role IN ('president', 'vice_president') THEN
    SELECT ARRAY[
      'dashboard.read','associates.read','associates.manage',
      'board.read','board.manage','finance.read','finance.manage',
      'protocols.read','protocols.manage','documents.read','documents.manage',
      'legal.read','legal.manage','institutional.read','institutional.manage',
      'meetings.read','meetings.manage','communications.read','communications.manage',
      'demands.read','demands.manage','reports.read','reports.manage',
      'users.read','users.manage','system.read','audit.read'
    ]::text[] INTO v_permissions;
    RETURN v_permissions;
  END IF;

  IF v_role = 'administrator' THEN
    RETURN ARRAY['dashboard.read','system.read','audit.read']::text[];
  END IF;

  SELECT COALESCE(array_agg(permission_key ORDER BY permission_key), ARRAY[]::text[])
    INTO v_permissions
    FROM (
      SELECT rp.permission_key, rp.allowed
        FROM anit.role_permissions rp
       WHERE rp.role = v_role
      UNION
      SELECT up.permission_key, up.allowed
        FROM anit.user_permissions up
       WHERE up.user_id = v_user
    ) p
   WHERE p.allowed = true
     AND p.permission_key <> '*'
     AND NOT EXISTS (
       SELECT 1
         FROM anit.user_permissions u
        WHERE u.user_id = v_user
          AND u.permission_key = p.permission_key
          AND u.allowed = false
     );

  RETURN v_permissions;
END;
$$;

-- Corrige também a validação de sessão: NULL não pode passar pela condição NOT IN.
CREATE OR REPLACE FUNCTION anit.set_user_permission(
  p_user_id uuid,
  p_permission_key text,
  p_allowed boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = anit, public
AS $$
DECLARE
  v_actor_role text;
  v_target_role text;
BEGIN
  SELECT role INTO v_actor_role
    FROM anit.user_profiles
   WHERE user_id = auth.uid() AND active = true;

  IF v_actor_role IS NULL OR v_actor_role NOT IN ('president', 'vice_president') THEN
    RAISE EXCEPTION 'Somente Presidente e Vice-presidente podem administrar permissões.';
  END IF;

  IF p_permission_key IS NULL OR p_permission_key = '*'
     OR p_permission_key !~ '^[a-z_]+\.(read|manage)$' THEN
    RAISE EXCEPTION 'Chave de permissão inválida.';
  END IF;

  SELECT role INTO v_target_role
    FROM anit.user_profiles
   WHERE user_id = p_user_id AND active = true;

  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'O usuário de destino não possui perfil institucional ativo.';
  END IF;

  IF v_target_role IN ('president', 'vice_president') THEN
    RAISE EXCEPTION 'As permissões da Presidência e Vice-presidência não podem ser alteradas individualmente.';
  END IF;

  INSERT INTO anit.user_permissions(user_id, permission_key, allowed, granted_by, updated_at)
  VALUES (p_user_id, p_permission_key, p_allowed, auth.uid(), now())
  ON CONFLICT (user_id, permission_key)
  DO UPDATE SET
    allowed = EXCLUDED.allowed,
    granted_by = EXCLUDED.granted_by,
    updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION anit.has_permission(text) TO authenticated;
GRANT EXECUTE ON FUNCTION anit.current_permissions() TO authenticated;
GRANT EXECUTE ON FUNCTION anit.set_user_permission(uuid, text, boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';
