-- Profiles table for user data
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Brigadeiros table
CREATE TABLE public.brigadeiros (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'tradicional' CHECK (tipo IN ('tradicional', 'gourmet', 'premium')),
  preco_venda DECIMAL(10,2) NOT NULL DEFAULT 0,
  custo_unitario DECIMAL(10,2) NOT NULL DEFAULT 0,
  margem_lucro DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE WHEN preco_venda > 0 THEN ((preco_venda - custo_unitario) / preco_venda) * 100 ELSE 0 END
  ) STORED,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Clientes table
CREATE TABLE public.clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  telefone TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Pedidos table
CREATE TABLE public.pedidos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente TEXT NOT NULL,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo_pedido TEXT NOT NULL DEFAULT 'encomenda' CHECK (tipo_pedido IN ('encomenda', 'pronta-entrega', 'evento')),
  valor_total DECIMAL(10,2) NOT NULL DEFAULT 0,
  forma_pagamento TEXT NOT NULL DEFAULT 'pix' CHECK (forma_pagamento IN ('pix', 'cartao', 'dinheiro', 'transferencia')),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em-producao', 'pronto', 'entregue', 'cancelado')),
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Itens do pedido
CREATE TABLE public.itens_pedido (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  brigadeiro_id UUID REFERENCES public.brigadeiros(id) ON DELETE SET NULL,
  brigadeiro_nome TEXT NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 1,
  preco_unitario DECIMAL(10,2) NOT NULL DEFAULT 0
);

-- Produção diária
CREATE TABLE public.producao_diaria (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  brigadeiro_id UUID REFERENCES public.brigadeiros(id) ON DELETE SET NULL,
  brigadeiro_nome TEXT NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 0,
  custo_total DECIMAL(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'planejado' CHECK (status IN ('planejado', 'em-andamento', 'concluido')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insumos/Estoque
CREATE TABLE public.insumos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  unidade TEXT NOT NULL,
  quantidade_atual DECIMAL(10,2) NOT NULL DEFAULT 0,
  quantidade_minima DECIMAL(10,2) NOT NULL DEFAULT 0,
  consumo_medio DECIMAL(10,2) NOT NULL DEFAULT 0,
  preco_unitario DECIMAL(10,2) NOT NULL DEFAULT 0,
  ultima_compra DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Transações financeiras
CREATE TABLE public.transacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  categoria TEXT NOT NULL,
  descricao TEXT NOT NULL,
  valor DECIMAL(10,2) NOT NULL DEFAULT 0,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  referencia TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brigadeiros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_pedido ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producao_diaria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transacoes ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Brigadeiros policies
CREATE POLICY "Users can view own brigadeiros" ON public.brigadeiros FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own brigadeiros" ON public.brigadeiros FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own brigadeiros" ON public.brigadeiros FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own brigadeiros" ON public.brigadeiros FOR DELETE USING (auth.uid() = user_id);

-- Clientes policies
CREATE POLICY "Users can view own clientes" ON public.clientes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own clientes" ON public.clientes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own clientes" ON public.clientes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own clientes" ON public.clientes FOR DELETE USING (auth.uid() = user_id);

-- Pedidos policies
CREATE POLICY "Users can view own pedidos" ON public.pedidos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own pedidos" ON public.pedidos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own pedidos" ON public.pedidos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own pedidos" ON public.pedidos FOR DELETE USING (auth.uid() = user_id);

-- Itens pedido policies (based on pedido ownership)
CREATE POLICY "Users can view own itens_pedido" ON public.itens_pedido FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.pedidos WHERE pedidos.id = itens_pedido.pedido_id AND pedidos.user_id = auth.uid()));
CREATE POLICY "Users can insert own itens_pedido" ON public.itens_pedido FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.pedidos WHERE pedidos.id = itens_pedido.pedido_id AND pedidos.user_id = auth.uid()));
CREATE POLICY "Users can update own itens_pedido" ON public.itens_pedido FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM public.pedidos WHERE pedidos.id = itens_pedido.pedido_id AND pedidos.user_id = auth.uid()));
CREATE POLICY "Users can delete own itens_pedido" ON public.itens_pedido FOR DELETE 
  USING (EXISTS (SELECT 1 FROM public.pedidos WHERE pedidos.id = itens_pedido.pedido_id AND pedidos.user_id = auth.uid()));

-- Producao diaria policies
CREATE POLICY "Users can view own producao" ON public.producao_diaria FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own producao" ON public.producao_diaria FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own producao" ON public.producao_diaria FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own producao" ON public.producao_diaria FOR DELETE USING (auth.uid() = user_id);

-- Insumos policies
CREATE POLICY "Users can view own insumos" ON public.insumos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own insumos" ON public.insumos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own insumos" ON public.insumos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own insumos" ON public.insumos FOR DELETE USING (auth.uid() = user_id);

-- Transacoes policies
CREATE POLICY "Users can view own transacoes" ON public.transacoes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transacoes" ON public.transacoes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own transacoes" ON public.transacoes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own transacoes" ON public.transacoes FOR DELETE USING (auth.uid() = user_id);

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_brigadeiros_updated_at BEFORE UPDATE ON public.brigadeiros FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_pedidos_updated_at BEFORE UPDATE ON public.pedidos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_insumos_updated_at BEFORE UPDATE ON public.insumos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();