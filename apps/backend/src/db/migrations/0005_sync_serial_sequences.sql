-- Sincronizar secuencias serial con el MAX(id) actual para evitar conflictos en INSERTs
SELECT setval('products_id_seq', COALESCE((SELECT MAX(id) FROM "products"), 1), (SELECT COUNT(*) > 0 FROM "products"));
--> statement-breakpoint
SELECT setval('categories_id_seq', COALESCE((SELECT MAX(id) FROM "categories"), 1), (SELECT COUNT(*) > 0 FROM "categories"));
--> statement-breakpoint
SELECT setval('tables_id_seq', COALESCE((SELECT MAX(id) FROM "tables"), 1), (SELECT COUNT(*) > 0 FROM "tables"));
