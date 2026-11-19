-- Public endpoint exposes only the allowlisted public-site configuration object.
CREATE OR REPLACE FUNCTION anit.get_public_site_settings()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = anit, public
AS $$
  SELECT COALESCE(
    (SELECT setting_value
       FROM anit.system_settings
      WHERE setting_key = 'public_site'
      LIMIT 1),
    '{}'::jsonb
  );
$$;

REVOKE ALL ON FUNCTION anit.get_public_site_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION anit.get_public_site_settings() TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
