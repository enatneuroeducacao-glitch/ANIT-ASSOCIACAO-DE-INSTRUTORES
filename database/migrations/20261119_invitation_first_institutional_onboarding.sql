-- Convite institucional: a Presidência autoriza o e-mail; o próprio integrante cria senha e confirma o e-mail.
CREATE TABLE IF NOT EXISTS anit.pending_user_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('treasurer','secretary','director','administrator')),
  permissions text[] NOT NULL DEFAULT ARRAY[]::text[],
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','expired','cancelled')),
  created_by uuid NOT NULL REFERENCES neon_auth."user"(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  CONSTRAINT pending_user_invitations_email_unique UNIQUE (email)
);
ALTER TABLE anit.pending_user_invitations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION anit.create_user_invitation(
  p_email text,
  p_full_name text,
  p_role text,
  p_permissions text[]
)
RETURNS TABLE(invitation_id uuid, invited_email text, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = anit, neon_auth, public
AS $$
DECLARE
  v_actor_role text;
  v_email text := lower(trim(COALESCE(p_email,'')));
  v_name text := trim(COALESCE(p_full_name,''));
  v_permissions text[] := COALESCE(p_permissions, ARRAY[]::text[]);
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
  v_id uuid;
  v_expiry timestamptz;
BEGIN
  SELECT role INTO v_actor_role FROM anit.user_profiles
   WHERE user_id = auth.uid() AND active = true;
  IF v_actor_role IS NULL OR v_actor_role NOT IN ('president','vice_president') THEN
    RAISE EXCEPTION 'Somente Presidente e Vice-presidente podem emitir convites institucionais.';
  END IF;
  IF v_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$' THEN
    RAISE EXCEPTION 'Informe um endereço de e-mail válido.';
  END IF;
  IF length(v_name) < 3 THEN RAISE EXCEPTION 'Informe o nome completo do integrante.'; END IF;
  IF p_role IS NULL OR p_role NOT IN ('treasurer','secretary','director','administrator') THEN
    RAISE EXCEPTION 'Função institucional inválida.';
  END IF;
  IF EXISTS (SELECT 1 FROM neon_auth."user" u WHERE lower(u.email)=v_email) THEN
    RAISE EXCEPTION 'Este e-mail já possui uma conta de acesso. Use o fluxo de vinculação de conta existente.';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_permissions) k WHERE NOT (k = ANY(v_allowed_keys))) THEN
    RAISE EXCEPTION 'A lista contém uma permissão não reconhecida.';
  END IF;
  INSERT INTO anit.pending_user_invitations(email,full_name,role,permissions,status,created_by,created_at,expires_at,accepted_at)
  VALUES(v_email,v_name,p_role,v_permissions,'pending',auth.uid(),now(),now()+interval '14 days',NULL)
  ON CONFLICT(email) DO UPDATE
    SET full_name=EXCLUDED.full_name,
        role=EXCLUDED.role,
        permissions=EXCLUDED.permissions,
        status='pending',
        created_by=EXCLUDED.created_by,
        created_at=now(),
        expires_at=now()+interval '14 days',
        accepted_at=NULL
    WHERE anit.pending_user_invitations.status IN ('expired','cancelled','pending');
  SELECT id, anit.pending_user_invitations.expires_at INTO v_id,v_expiry
    FROM anit.pending_user_invitations WHERE email=v_email AND status='pending';
  IF v_id IS NULL THEN RAISE EXCEPTION 'Já existe um convite aceito para este endereço.'; END IF;
  RETURN QUERY SELECT v_id,v_email,v_expiry;
END;
$$;

CREATE OR REPLACE FUNCTION anit.require_institutional_invitation()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = anit, neon_auth, public
AS $$
DECLARE v_invitation anit.pending_user_invitations%ROWTYPE;
BEGIN
  SELECT * INTO v_invitation
    FROM anit.pending_user_invitations
   WHERE email=lower(trim(NEW.email))
     AND status='pending'
     AND expires_at > now()
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Este e-mail não possui convite institucional válido. Solicite autorização à Presidência da ANIT.';
  END IF;
  NEW.name := v_invitation.full_name;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION anit.provision_invited_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = anit, neon_auth, public
AS $$
DECLARE v_invitation anit.pending_user_invitations%ROWTYPE;
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
BEGIN
  SELECT * INTO v_invitation FROM anit.pending_user_invitations
   WHERE email=lower(trim(NEW.email)) AND status='pending' AND expires_at>now()
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Convite institucional não localizado durante a criação da conta.'; END IF;

  INSERT INTO anit.user_profiles(user_id,full_name,role,active,created_at,updated_at)
  VALUES(NEW.id,v_invitation.full_name,v_invitation.role,COALESCE(NEW."emailVerified",false),now(),now());

  INSERT INTO anit.user_permissions(user_id,permission_key,allowed,granted_by,created_at,updated_at)
  SELECT NEW.id,k,k=ANY(v_invitation.permissions),v_invitation.created_by,now(),now()
    FROM unnest(v_allowed_keys) k
  ON CONFLICT(user_id,permission_key) DO UPDATE
    SET allowed=EXCLUDED.allowed,granted_by=EXCLUDED.granted_by,updated_at=now();

  IF COALESCE(NEW."emailVerified",false) THEN
    UPDATE anit.pending_user_invitations SET status='accepted',accepted_at=now() WHERE id=v_invitation.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION anit.activate_verified_invited_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = anit, neon_auth, public
AS $$
DECLARE v_invitation_id uuid;
BEGIN
  IF NEW."emailVerified" IS TRUE AND OLD."emailVerified" IS DISTINCT FROM TRUE THEN
    SELECT id INTO v_invitation_id FROM anit.pending_user_invitations
     WHERE email=lower(trim(NEW.email)) AND status='pending' AND expires_at>now();
    IF v_invitation_id IS NOT NULL THEN
      UPDATE anit.user_profiles SET active=true,updated_at=now() WHERE user_id=NEW.id;
      UPDATE anit.pending_user_invitations SET status='accepted',accepted_at=now() WHERE id=v_invitation_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS anit_require_invitation_before_auth_user_insert ON neon_auth."user";
CREATE TRIGGER anit_require_invitation_before_auth_user_insert
BEFORE INSERT ON neon_auth."user"
FOR EACH ROW EXECUTE FUNCTION anit.require_institutional_invitation();

DROP TRIGGER IF EXISTS anit_provision_invited_user_after_auth_insert ON neon_auth."user";
CREATE TRIGGER anit_provision_invited_user_after_auth_insert
AFTER INSERT ON neon_auth."user"
FOR EACH ROW EXECUTE FUNCTION anit.provision_invited_user();

DROP TRIGGER IF EXISTS anit_activate_verified_invited_user ON neon_auth."user";
CREATE TRIGGER anit_activate_verified_invited_user
AFTER UPDATE OF "emailVerified" ON neon_auth."user"
FOR EACH ROW EXECUTE FUNCTION anit.activate_verified_invited_user();

REVOKE ALL ON FUNCTION anit.create_user_invitation(text,text,text,text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION anit.create_user_invitation(text,text,text,text[]) TO authenticated;
NOTIFY pgrst, 'reload schema';
