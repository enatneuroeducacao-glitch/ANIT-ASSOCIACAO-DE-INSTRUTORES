-- Cadastro de usuários institucionais por e-mail, com lookup restrito e gravação atômica de permissões.
-- Somente Presidente e Vice-presidente podem localizar contas e provisionar perfis.

CREATE OR REPLACE FUNCTION anit.find_auth_user_by_email(p_email text)
RETURNS TABLE(user_id uuid, full_name text, email text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = anit, neon_auth, public
AS $$
DECLARE
  v_actor_role text;
BEGIN
  SELECT role INTO v_actor_role
    FROM anit.user_profiles
   WHERE user_id = auth.uid() AND active = true;

  IF v_actor_role IS NULL OR v_actor_role NOT IN ('president','vice_president') THEN
    RAISE EXCEPTION 'Somente Presidente e Vice-presidente podem localizar contas para cadastro.';
  END IF;

  IF p_email IS NULL OR length(trim(p_email)) < 5 OR position('@' in p_email) < 2 THEN
    RAISE EXCEPTION 'Informe um e-mail válido.';
  END IF;

  RETURN QUERY
  SELECT u.id, u.name, u.email
    FROM neon_auth."user" u
   WHERE lower(u.email) = lower(trim(p_email))
     AND COALESCE(u.banned, false) = false
   LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION anit.create_institutional_profile(
  p_email text,
  p_user_id uuid,
  p_full_name text,
  p_role text,
  p_active boolean,
  p_permissions text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = anit, neon_auth, public
AS $$
DECLARE
  v_actor_role text;
  v_auth_email text;
  v_existing_role text;
  v_allowed_keys text[] := ARRAY[
    'dashboard.read',
    'associates.read','associates.manage',
    'board.read','board.manage',
    'finance.read','finance.manage',
    'protocols.read','protocols.manage',
    'documents.read','documents.manage',
    'legal.read','legal.manage',
    'institutional.read','institutional.manage',
    'meetings.read','meetings.manage',
    'communications.read','communications.manage',
    'demands.read','demands.manage',
    'reports.read','reports.manage',
    'system.read','audit.read'
  ]::text[];
  v_permissions text[] := COALESCE(p_permissions, ARRAY[]::text[]);
BEGIN
  SELECT role INTO v_actor_role
    FROM anit.user_profiles
   WHERE user_id = auth.uid() AND active = true;

  IF v_actor_role IS NULL OR v_actor_role NOT IN ('president','vice_president') THEN
    RAISE EXCEPTION 'Somente Presidente e Vice-presidente podem cadastrar perfis e permissões.';
  END IF;

  IF p_role IS NULL OR p_role NOT IN ('treasurer','secretary','director','administrator') THEN
    RAISE EXCEPTION 'Função institucional inválida.';
  END IF;

  IF p_user_id IS NULL OR p_email IS NULL OR p_full_name IS NULL OR length(trim(p_full_name)) < 3 THEN
    RAISE EXCEPTION 'Informe uma conta localizada e um nome completo válido.';
  END IF;

  SELECT u.email INTO v_auth_email
    FROM neon_auth."user" u
   WHERE u.id = p_user_id
     AND lower(u.email) = lower(trim(p_email))
     AND COALESCE(u.banned, false) = false;

  IF v_auth_email IS NULL THEN
    RAISE EXCEPTION 'A conta não corresponde ao e-mail informado ou está indisponível.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(v_permissions) permission_key
     WHERE NOT (permission_key = ANY(v_allowed_keys))
  ) THEN
    RAISE EXCEPTION 'A lista contém uma permissão não reconhecida.';
  END IF;

  SELECT role INTO v_existing_role
    FROM anit.user_profiles
   WHERE user_id = p_user_id
   FOR UPDATE;

  IF v_existing_role IN ('president','vice_president') THEN
    RAISE EXCEPTION 'Os cargos da Presidência e Vice-presidência não podem ser alterados por este cadastro.';
  END IF;

  INSERT INTO anit.user_profiles(user_id, full_name, role, active, created_at, updated_at)
  VALUES (p_user_id, trim(p_full_name), p_role, COALESCE(p_active, true), now(), now())
  ON CONFLICT (user_id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        active = EXCLUDED.active,
        updated_at = now();

  INSERT INTO anit.user_permissions(user_id, permission_key, allowed, granted_by, updated_at)
  SELECT p_user_id, permission_key, permission_key = ANY(v_permissions), auth.uid(), now()
    FROM unnest(v_allowed_keys) AS permission_key
  ON CONFLICT (user_id, permission_key) DO UPDATE
    SET allowed = EXCLUDED.allowed,
        granted_by = EXCLUDED.granted_by,
        updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION anit.find_auth_user_by_email(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION anit.create_institutional_profile(text,uuid,text,text,boolean,text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION anit.find_auth_user_by_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION anit.create_institutional_profile(text,uuid,text,text,boolean,text[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
