-- Console técnica restrita para o perfil administrador.
-- Não concede acesso a dados institucionais nem poderes de gestão de usuários.
INSERT INTO anit.role_permissions(role, permission_key, allowed)
VALUES ('administrator', 'system.read', true)
ON CONFLICT (role, permission_key)
DO UPDATE SET allowed = EXCLUDED.allowed;

-- Mantém explicitamente revogado qualquer curinga histórico.
UPDATE anit.role_permissions
   SET allowed = false
 WHERE role = 'administrator' AND permission_key = '*';
