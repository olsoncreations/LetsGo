-- Rename "Pacific" zone to "West" to match standard 5-division naming
UPDATE sales_zones SET name = 'West' WHERE name = 'Pacific';
