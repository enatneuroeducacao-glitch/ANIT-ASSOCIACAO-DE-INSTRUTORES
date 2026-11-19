-- Governança institucional: somente Presidência e Vice-presidência administram usuários.
-- Idempotente; preserva usuários, perfis e permissões existentes.

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
  IF v_user IS NULL THEN RETURN false; END IF;
  SELECT role INTO v_role FROM anit.user_profiles
   WHERE user_id = v_user AND active = true;
  IF v_role IS NULL THEN RETURN false; END IF;
  -- Controle integral é exclusivo dos dois cargos estatutários.
  IF v_role IN ('president','vice_president') THEN RETURN true; END IF;

  SELECT allowed INTO v_override FROM anit.user_permissions
   WHERE user_id = v_user AND permission_key = p_permission_key;
  IF FOUND THEN RETURN v_override; END IF;

  SELECT allowed INTO v_role_allowed FROM anit.role_permissions
   WHERE role = v_role AND permission_key = p_permission_key;
  RETURN COALESCE(v_role_allowed, false);
END;
$$;

CREATE OR REPLACE FUNCTION anit.current_permissions()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = anit, public
AS $$
  WITH actor AS (
    SELECT role FROM anit.user_profiles
     WHERE user_id = auth.uid() AND active = true
  ),
  known_permissions(permission_key) AS (
    VALUES
      ('dashboard.read'),('associates.read'),('associates.manage'),
      ('board.read'),('board.manage'),('finance.read'),('finance.manage'),
      ('protocols.read'),('protocols.manage'),('documents.read'),('documents.manage'),
      ('legal.read'),('legal.manage'),('institutional.read'),('institutional.manage'),
      ('meetings.read'),('meetings.manage'),('communications.read'),('communications.manage'),
      ('demands.read'),('demands.manage'),('reports.read'),('reports.manage'),
      ('users.read'),('users.manage')
  ),
  base AS (
    SELECT rp.permission_key, rp.allowed
      FROM anit.role_permissions rp JOIN actor a ON a.role = rp.role
    UNION
    SELECT kp.permission_key, true
      FROM known_permissions kp JOIN actor a ON a.role IN ('president','vice_president')
    UNION
    SELECT up.permission_key, up.allowed
      FROM anit.user_permissions up WHERE up.user_id = auth.uid()
  )
  SELECT COALESCE(array_agg(DISTINCT b.permission_key ORDER BY b.permission_key), ARRAY[]::text[])
    FROM base b
   WHERE b.allowed = true
     AND NOT EXISTS (
       SELECT 1 FROM anit.user_permissions x
        WHERE x.user_id = auth.uid()
          AND x.permission_key = b.permission_key
          AND x.allowed = false
     );
$$;

CREATE OR REPLACE FUNCTION anit.set_user_permission(
  p_user_id uuid, p_permission_key text, p_allowed boolean
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
  SELECT role INTO v_actor_role FROM anit.user_profiles
   WHERE user_id = auth.uid() AND active = true;
  IF v_actor_role NOT IN ('president','vice_president') THEN
    RAISE EXCEPTION 'Somente Presidente e Vice-presidente podem administrar permissões.';
  END IF;

  SELECT role INTO v_target_role FROM anit.user_profiles
   WHERE user_id = p_user_id AND active = true;
  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'O usuário de destino não possui perfil institucional ativo.';
  END IF;
  IF v_target_role IN ('president','vice_president') THEN
    RAISE EXCEPTION 'As permissões da Presidência e Vice-presidência não podem ser alteradas individualmente.';
  END IF;

  INSERT INTO anit.user_permissions(user_id, permission_key, allowed, granted_by, updated_at)
  VALUES (p_user_id, p_permission_key, p_allowed, auth.uid(), now())
  ON CONFLICT (user_id, permission_key)
  DO UPDATE SET allowed = EXCLUDED.allowed, granted_by = EXCLUDED.granted_by, updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION anit.guard_institutional_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = anit, public
AS $$
DECLARE
  v_actor_role text;
BEGIN
  SELECT role INTO v_actor_role FROM anit.user_profiles
   WHERE user_id = auth.uid() AND active = true;

  IF TG_OP = 'INSERT' AND NEW.role IN ('president','vice_president') THEN
    RAISE EXCEPTION 'Cargos de Presidência e Vice-presidência não podem ser criados pelo cadastro comum.';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.role IN ('president','vice_president')
     AND (NEW.role IS DISTINCT FROM OLD.role OR NEW.active IS DISTINCT FROM OLD.active
          OR NEW.user_id IS DISTINCT FROM OLD.user_id) THEN
    RAISE EXCEPTION 'O vínculo estatutário da Presidência e Vice-presidência é protegido.';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.role IN ('president','vice_president')
     AND NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Não é permitido promover usuários a cargos estatutários por esta tela.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_institutional_roles ON anit.user_profiles;
CREATE TRIGGER guard_institutional_roles
BEFORE INSERT OR UPDATE ON anit.user_profiles
FOR EACH ROW EXECUTE FUNCTION anit.guard_institutional_roles();

-- Permissões de gestão de usuários e configurações derivam de has_permission(),
-- que agora reconhece exclusivamente Presidente e Vice-presidente como gestores.
NOTIFY pgrst, 'reload schema';
