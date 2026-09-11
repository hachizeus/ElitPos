SELECT u.id, u.email, u.role, u.is_active, u.account_id, t.slug
FROM users u
JOIN tenants t ON t.id = u.tenant_id
WHERE t.slug IN ('kahustle1', 'elitjohnsdigitalagency')
ORDER BY t.slug, u.email;
