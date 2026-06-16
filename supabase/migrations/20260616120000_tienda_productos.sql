-- Tienda de productos: catálogo gestionable por admin, visible en el portal.

-- 1. Categorías de productos
CREATE TABLE IF NOT EXISTS product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Productos
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0 CHECK (price >= 0),
  category_id uuid REFERENCES product_categories(id) ON DELETE SET NULL,
  images text[] NOT NULL DEFAULT '{}',
  in_stock boolean NOT NULL DEFAULT true,
  featured boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);

-- 3. WhatsApp del gimnasio (contacto único para la tienda)
ALTER TABLE gym_settings ADD COLUMN IF NOT EXISTS whatsapp text;

-- 4. RLS (mismo patrón que routine_schedules: lectura authenticated, escritura admins)
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read product_categories" ON product_categories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins write product_categories" ON product_categories
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "auth read products" ON products
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins write products" ON products
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
