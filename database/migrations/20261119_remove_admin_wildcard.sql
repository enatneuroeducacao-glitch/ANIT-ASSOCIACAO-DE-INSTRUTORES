-- Remove a permissão curinga histórica do administrador técnico.
-- O perfil técnico não recebe acesso institucional automático.
UPDATE anit.role_permissions
   SET allowed = false
 WHERE role = 'administrator'
   AND permission_key = '*'
   AND allowed = true;
