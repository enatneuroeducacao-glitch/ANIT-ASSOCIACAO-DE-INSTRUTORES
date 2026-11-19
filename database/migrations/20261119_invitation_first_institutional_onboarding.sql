CREATE TABLE IF NOT EXISTS anit.pending_user_invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL UNIQUE, full_name text NOT NULL,
 role text NOT NULL CHECK(role IN ('treasurer','secretary','director','administrator')),
 permissions text[] NOT NULL DEFAULT ARRAY[]::text[], invite_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','expired','cancelled')),
 created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT(now()+interval '14 days'), accepted_at timestamptz
);
ALTER TABLE anit.pending_user_invitations ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION anit.create_user_invitation(p_email text,p_full_name text,p_role text,p_permissions text[])
RETURNS TABLE(invitation_id uuid,invited_email text,invite_token uuid,expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=anit,neon_auth,public AS $$
DECLARE v_actor_role text; v_email text:=lower(trim(COALESCE(p_email,''))); v_name text:=trim(COALESCE(p_full_name,''));
v_permissions text[]:=COALESCE(p_permissions,ARRAY[]::text[]);
v_allowed_keys text[]:=ARRAY['dashboard.read','associates.read','associates.manage','board.read','board.manage','finance.read','finance.manage','protocols.read','protocols.manage','documents.read','documents.manage','legal.read','legal.manage','institutional.read','institutional.manage','meetings.read','meetings.manage','communications.read','communications.manage','demands.read','demands.manage','reports.read','reports.manage','system.read','audit.read']::text[];
v_id uuid; v_token uuid; v_expiry timestamptz;
BEGIN
SELECT role INTO v_actor_role FROM anit.user_profiles WHERE user_id=auth.uid() AND active=true;
IF v_actor_role IS NULL OR v_actor_role NOT IN ('president','vice_president') THEN RAISE EXCEPTION 'Somente Presidente e Vice-presidente podem emitir convites institucionais.'; END IF;
IF v_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$' THEN RAISE EXCEPTION 'Informe um endereço de e-mail válido.'; END IF;
IF length(v_name)<3 THEN RAISE EXCEPTION 'Informe o nome completo do integrante.'; END IF;
IF p_role IS NULL OR p_role NOT IN ('treasurer','secretary','director','administrator') THEN RAISE EXCEPTION 'Função institucional inválida.'; END IF;
IF EXISTS(SELECT 1 FROM neon_auth."user" u WHERE lower(u.email)=v_email) THEN RAISE EXCEPTION 'Este e-mail já possui uma conta de acesso. Solicite a vinculação do perfil existente.'; END IF;
IF EXISTS(SELECT 1 FROM unnest(v_permissions) k WHERE NOT(k=ANY(v_allowed_keys))) THEN RAISE EXCEPTION 'A lista contém uma permissão não reconhecida.'; END IF;
INSERT INTO anit.pending_user_invitations(email,full_name,role,permissions,invite_token,status,created_by,created_at,expires_at,accepted_at)
VALUES(v_email,v_name,p_role,v_permissions,gen_random_uuid(),'pending',auth.uid(),now(),now()+interval '14 days',NULL)
ON CONFLICT(email) DO UPDATE SET full_name=EXCLUDED.full_name,role=EXCLUDED.role,permissions=EXCLUDED.permissions,invite_token=EXCLUDED.invite_token,status='pending',created_by=EXCLUDED.created_by,created_at=now(),expires_at=now()+interval '14 days',accepted_at=NULL
WHERE anit.pending_user_invitations.status IN ('expired','cancelled','pending');
SELECT id,invite_token,expires_at INTO v_id,v_token,v_expiry FROM anit.pending_user_invitations WHERE email=v_email AND status='pending';
IF v_id IS NULL THEN RAISE EXCEPTION 'Já existe um convite aceito para este endereço.'; END IF;
RETURN QUERY SELECT v_id,v_email,v_token,v_expiry;
END; $$;
CREATE OR REPLACE FUNCTION anit.claim_user_invitation(p_invite_token uuid)
RETURNS TABLE(profile_id uuid,full_name text,role text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=anit,public AS $$
DECLARE v_uid uuid:=auth.uid(); v_email text:=lower(trim(COALESCE(auth.jwt()->>'email','')));
v_invitation anit.pending_user_invitations%ROWTYPE;
v_allowed_keys text[]:=ARRAY['dashboard.read','associates.read','associates.manage','board.read','board.manage','finance.read','finance.manage','protocols.read','protocols.manage','documents.read','documents.manage','legal.read','legal.manage','institutional.read','institutional.manage','meetings.read','meetings.manage','communications.read','communications.manage','demands.read','demands.manage','reports.read','reports.manage','system.read','audit.read']::text[];
BEGIN
IF v_uid IS NULL OR v_email='' THEN RAISE EXCEPTION 'Entre na conta autenticada após confirmar o e-mail.'; END IF;
SELECT * INTO v_invitation FROM anit.pending_user_invitations WHERE invite_token=p_invite_token AND email=v_email AND status='pending' AND expires_at>now() FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'Convite inválido, expirado ou destinado a outro endereço de e-mail.'; END IF;
IF EXISTS(SELECT 1 FROM anit.user_profiles WHERE user_id=v_uid) THEN RAISE EXCEPTION 'Esta conta já possui um perfil institucional.'; END IF;
INSERT INTO anit.user_profiles(user_id,full_name,role,active,created_at,updated_at) VALUES(v_uid,v_invitation.full_name,v_invitation.role,true,now(),now());
INSERT INTO anit.user_permissions(user_id,permission_key,allowed,granted_by,created_at,updated_at)
SELECT v_uid,k,k=ANY(v_invitation.permissions),v_invitation.created_by,now(),now() FROM unnest(v_allowed_keys) k
ON CONFLICT(user_id,permission_key) DO UPDATE SET allowed=EXCLUDED.allowed,granted_by=EXCLUDED.granted_by,updated_at=now();
UPDATE anit.pending_user_invitations SET status='accepted',accepted_at=now() WHERE id=v_invitation.id;
RETURN QUERY SELECT v_uid,v_invitation.full_name,v_invitation.role;
END; $$;
REVOKE ALL ON FUNCTION anit.create_user_invitation(text,text,text,text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION anit.claim_user_invitation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION anit.create_user_invitation(text,text,text,text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION anit.claim_user_invitation(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';