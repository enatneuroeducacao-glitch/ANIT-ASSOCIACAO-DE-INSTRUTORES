-- Permissões de leitura operacional para o administrador técnico.
INSERT INTO anit.role_permissions(role, permission_key, allowed)
VALUES ('administrator','dashboard.read',true),
       ('administrator','audit.read',true),
       ('administrator','system.read',true)
ON CONFLICT (role, permission_key)
DO UPDATE SET allowed = EXCLUDED.allowed;

-- Mantém o curinga explicitamente revogado.
UPDATE anit.role_permissions
   SET allowed = false
 WHERE role = 'administrator' AND permission_key = '*';

-- Auditoria técnica permite apenas leitura resumida; a UI não consulta IDs ou campos pessoais.
DROP POLICY IF EXISTS audit_read ON anit.audit_log;
CREATE POLICY audit_read ON anit.audit_log
FOR SELECT TO authenticated
USING (anit.has_permission('audit.read') OR anit.has_permission('users.manage'));
