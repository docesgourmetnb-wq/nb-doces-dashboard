-- Create Estoque Massas table
CREATE TABLE IF NOT EXISTS estoque_massas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sabor TEXT NOT NULL UNIQUE,
  quantidade_g NUMERIC DEFAULT 0,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE estoque_massas ENABLE ROW LEVEL SECURITY;

-- Create Policies
CREATE POLICY "Users can create their own massas" ON estoque_massas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own massas" ON estoque_massas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own massas" ON estoque_massas FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own massas" ON estoque_massas FOR DELETE USING (auth.uid() = user_id);

-- Create Estoque Produtos table
CREATE TABLE IF NOT EXISTS estoque_produtos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brigadeiro_id UUID REFERENCES brigadeiros(id) ON DELETE CASCADE UNIQUE,
  quantidade_un INT DEFAULT 0,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE estoque_produtos ENABLE ROW LEVEL SECURITY;

-- Create Policies
CREATE POLICY "Users can create their own produtos" ON estoque_produtos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own produtos" ON estoque_produtos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own produtos" ON estoque_produtos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own produtos" ON estoque_produtos FOR DELETE USING (auth.uid() = user_id);
