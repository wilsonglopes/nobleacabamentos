-- SQL Script to add unit products (1 Unidade) for Terminal de Cumeeira and Conexão 3 Vias
-- Based on the user's requested prices: R$ 12.00 and R$ 35.00

INSERT INTO products (name, brand, color, category, price, original_price, weight_g, length_cm, width_cm, height_cm, image_url, description)
SELECT 
    'Terminal de Cumeeira (1 Unidade) - ' || initcap(color) as name,
    brand,
    color,
    'terminal' as category,
    12.00 as price,
    18.00 as original_price,
    350 as weight_g,
    15 as length_cm,
    15 as width_cm,
    10 as height_cm,
    CASE WHEN color = 'marfim' THEN 'assets/produtos/terminal_marfin.jpg' ELSE 'assets/produtos/terminal_' || color || '.jpg' END as image_url,
    '1 Unidade. Terminal de Cumeeira na cor ' || color || '. Produzido pela ' || brand || '. Peso: 0.35 kg | Dimensões: 15x15x10cm. Garantia de qualidade.' as description
FROM (
    SELECT DISTINCT brand, color FROM products WHERE name ILIKE 'Terminal de Cumeeira%'
) as base_products;

INSERT INTO products (name, brand, color, category, price, original_price, weight_g, length_cm, width_cm, height_cm, image_url, description)
SELECT 
    'Conexão 3 Vias (1 Unidade) - ' || initcap(color) as name,
    brand,
    color,
    'conexao' as category,
    35.00 as price,
    42.00 as original_price,
    700 as weight_g,
    35 as length_cm,
    35 as width_cm,
    20 as height_cm,
    'assets/produtos/terminal3vias_' || color || '.jpg' as image_url,
    '1 Unidade. Conexão 3 Vias na cor ' || color || '. Produzido pela ' || brand || '. Peso: 0.7 kg | Dimensões: 35x35x20cm. Garantia de qualidade.' as description
FROM (
    SELECT DISTINCT brand, color FROM products WHERE name ILIKE 'Conexão 3 Vias%'
) as base_products;
