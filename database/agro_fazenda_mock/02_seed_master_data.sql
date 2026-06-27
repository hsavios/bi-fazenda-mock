-- 02_seed_master_data.sql — dados mestres fictícios
SET search_path TO agro, public;

-- Unidades de medida
INSERT INTO unidades_medida (sigla, descricao) VALUES
    ('kg', 'Quilograma'),
    ('L', 'Litro'),
    ('sc', 'Saca 60 kg'),
    ('t', 'Tonelada'),
    ('un', 'Unidade'),
    ('ha', 'Hectare'),
    ('cx', 'Caixa'),
    ('bag', 'Bag 1000 kg');

-- Categorias de insumo
INSERT INTO categorias_insumo (codigo, nome, tipo) VALUES
    ('CAT-DEF', 'Defensivos', 'defensivo'),
    ('CAT-FERT', 'Fertilizantes', 'fertilizante'),
    ('CAT-SEM', 'Sementes', 'semente'),
    ('CAT-CORR', 'Corretivos', 'corretivo'),
    ('CAT-ADJ', 'Adjuvantes', 'adjuvante');

-- Fazenda
INSERT INTO fazendas (codigo, razao_social, nome_fantasia, cnpj, inscricao_estadual, municipio, uf, area_total_ha)
VALUES ('FAZ-001', 'Fazenda Boa Esperança Agro Ltda.', 'Boa Esperança Agro', '12.345.678/0001-90', '109876543', 'Rio Verde', 'GO', 4850.0000);

-- Unidades produtivas
INSERT INTO unidades_produtivas (fazenda_id, codigo, nome, tipo, area_ha) VALUES
    (1, 'UP-GRAOS', 'Unidade Grãos Norte', 'grãos', 3200.0000),
    (1, 'UP-CAFE', 'Unidade Café Sul', 'café', 1650.0000);

-- Culturas (5)
INSERT INTO culturas (codigo, nome, tipo, unidade_producao, peso_saca_kg) VALUES
    ('SOJA', 'Soja', 'grão', 'saca', 60.00),
    ('MILHO', 'Milho', 'grão', 'saca', 60.00),
    ('SORGO', 'Sorgo', 'grão', 'saca', 60.00),
    ('FEIJAO', 'Feijão', 'leguminosa', 'saca', 60.00),
    ('CAFE', 'Café', 'perene', 'saca', 60.00);

-- Variedades
INSERT INTO variedades (cultura_id, codigo, nome, ciclo_dias, produtividade_esperada_sc_ha) VALUES
    (1, 'SOJA-BMX', 'BMX Potência RR', 115, 62.00),
    (1, 'SOJA-MG', 'MG/BR 790 RR', 118, 58.00),
    (1, 'SOJA-NS', 'NS 6909 IPRO', 112, 65.00),
    (2, 'MILHO-AG', 'AG 8088 PRO3', 130, 110.00),
    (2, 'MILHO-P3', 'P3707VYH', 125, 105.00),
    (3, 'SORGO-BRS', 'BRS 655', 105, 80.00),
    (3, 'SORGO-ADV', 'ADV 9101', 100, 85.00),
    (4, 'FEIJAO-BRS', 'BRS Estilo', 85, 35.00),
    (4, 'FEIJAO-CV', 'CV Moreno', 90, 32.00),
    (5, 'CAFE-ARAB', 'Arábica Mundo Novo', 365, 25.00),
    (5, 'CAFE-CAT', 'Catuaí Vermelho', 365, 28.00);

-- Safras (cadastro mestre; dados operacionais em 03)
INSERT INTO safras (codigo, nome, data_inicio, data_fim, status) VALUES
    ('2023/24', 'Safra 2023/2024', '2023-09-01', '2024-08-31', 'encerrada'),
    ('2024/25', 'Safra 2024/2025', '2024-09-01', '2025-08-31', 'encerrada'),
    ('2025/26', 'Safra 2025/2026', '2025-09-01', '2026-08-31', 'em_andamento');

-- Talhões (20)
INSERT INTO talhoes (unidade_produtiva_id, codigo, nome, area_ha, latitude, longitude, tipo_solo) VALUES
    (1, 'T-001', 'Talhão Norte 1', 180.5000, -17.7850, -50.9200, 'Latossolo Vermelho'),
    (1, 'T-002', 'Talhão Norte 2', 195.2500, -17.7860, -50.9180, 'Latossolo Vermelho'),
    (1, 'T-003', 'Talhão Norte 3', 210.0000, -17.7870, -50.9160, 'Latossolo Vermelho'),
    (1, 'T-004', 'Talhão Norte 4', 175.7500, -17.7880, -50.9140, 'Argissolo'),
    (1, 'T-005', 'Talhão Norte 5', 220.0000, -17.7890, -50.9120, 'Latossolo Vermelho'),
    (1, 'T-006', 'Talhão Central 1', 165.0000, -17.7900, -50.9100, 'Latossolo Vermelho'),
    (1, 'T-007', 'Talhão Central 2', 188.5000, -17.7910, -50.9080, 'Latossolo Vermelho'),
    (1, 'T-008', 'Talhão Central 3', 200.0000, -17.7920, -50.9060, 'Argissolo'),
    (1, 'T-009', 'Talhão Central 4', 192.2500, -17.7930, -50.9040, 'Latossolo Vermelho'),
    (1, 'T-010', 'Talhão Sul Grãos 1', 178.0000, -17.7940, -50.9020, 'Latossolo Vermelho'),
    (1, 'T-011', 'Talhão Sul Grãos 2', 205.5000, -17.7950, -50.9000, 'Latossolo Vermelho'),
    (1, 'T-012', 'Talhão Sul Grãos 3', 190.7500, -17.7960, -50.8980, 'Argissolo'),
    (1, 'T-013', 'Talhão Oeste 1', 155.0000, -17.7970, -50.8960, 'Latossolo Vermelho'),
    (1, 'T-014', 'Talhão Oeste 2', 168.2500, -17.7980, -50.8940, 'Latossolo Vermelho'),
    (1, 'T-015', 'Talhão Oeste 3', 142.5000, -17.7990, -50.8920, 'Neossolo'),
    (2, 'T-C01', 'Talhão Café 1', 320.0000, -17.8100, -50.8800, 'Latossolo Vermelho'),
    (2, 'T-C02', 'Talhão Café 2', 285.5000, -17.8110, -50.8780, 'Latossolo Vermelho'),
    (2, 'T-C03', 'Talhão Café 3', 310.0000, -17.8120, -50.8760, 'Argissolo'),
    (2, 'T-C04', 'Talhão Café 4', 275.2500, -17.8130, -50.8740, 'Latossolo Vermelho'),
    (2, 'T-C05', 'Talhão Café 5', 459.2500, -17.8140, -50.8720, 'Latossolo Vermelho');

-- Armazéns
INSERT INTO armazens (codigo, nome, tipo, capacidade_t, unidade_produtiva_id) VALUES
    ('ARM-INS', 'Armazém Insumos Central', 'insumos', 500.00, NULL),
    ('ARM-GRAOS', 'Armazém Grãos Norte', 'producao', 12000.00, 1),
    ('ARM-CAFE', 'Armazém Café Sul', 'producao', 3000.00, 2),
    ('ARM-MISTO', 'Galpão Misto Operacional', 'misto', 800.00, 1);

-- Fornecedores (12)
INSERT INTO fornecedores (codigo, razao_social, cnpj, municipio, uf, telefone, email) VALUES
    ('FOR-001', 'AgroInsumos Rio Verde Ltda.', '11.111.111/0001-11', 'Rio Verde', 'GO', '(64) 3611-1000', 'vendas@agroinsumosrv.com.br'),
    ('FOR-002', 'Cooperativa Campo Forte', '22.222.222/0001-22', 'Jataí', 'GO', '(64) 3632-2000', 'compras@campoforte.coop.br'),
    ('FOR-003', 'Sementes Premium GO', '33.333.333/0001-33', 'Rio Verde', 'GO', '(64) 3611-3000', 'contato@sementespremium.com.br'),
    ('FOR-004', 'Defensivos AgroTech SA', '44.444.444/0001-44', 'São Paulo', 'SP', '(11) 3000-4000', 'vendas@agrotech.com.br'),
    ('FOR-005', 'Fertilizantes Brasil Central', '55.555.555/0001-55', 'Uberaba', 'MG', '(34) 3311-5000', 'vendas@fertbrasil.com.br'),
    ('FOR-006', 'Posto Combustível BR-060', '66.666.666/0001-66', 'Rio Verde', 'GO', '(64) 3611-6000', NULL),
    ('FOR-007', 'Mecânica Agrícola Sul', '77.777.777/0001-77', 'Jataí', 'GO', '(64) 3632-7000', 'oficina@mecagrisul.com.br'),
    ('FOR-008', 'Transportadora Grãos Express', '88.888.888/0001-88', 'Rio Verde', 'GO', '(64) 3611-8000', 'logistica@graosexpress.com.br'),
    ('FOR-009', 'Laboratório Solo Análise', '99.999.999/0001-99', 'Goiânia', 'GO', '(62) 3200-9000', 'lab@soloanalise.com.br'),
    ('FOR-010', 'Consultoria Agronômica Verde', '10.101.010/0001-10', 'Rio Verde', 'GO', '(64) 3611-1010', 'contato@verdeagro.com.br'),
    ('FOR-011', 'Energia Solar Rural Ltda.', '20.202.020/0001-20', 'Goiânia', 'GO', '(62) 3200-2020', 'vendas@solarrural.com.br'),
    ('FOR-012', 'Peças Trator Peças GO', '30.303.030/0001-30', 'Rio Verde', 'GO', '(64) 3611-3030', 'pecas@tratorpecasgo.com.br');

-- Clientes (10)
INSERT INTO clientes (codigo, razao_social, cnpj_cpf, municipio, uf, telefone, email) VALUES
    ('CLI-001', 'Trading Grãos Internacional SA', '91.111.111/0001-91', 'Santos', 'SP', '(13) 3200-1000', 'compras@tradinggraos.com.br'),
    ('CLI-002', 'Cooperativa Exportadora Sul', '92.222.222/0001-92', 'Paranaguá', 'PR', '(41) 3400-2000', 'export@sulcoop.com.br'),
    ('CLI-003', 'Indústria Alimentícia Norte', '93.333.333/0001-93', 'Goiânia', 'GO', '(62) 3200-3000', 'suprimentos@alimenticianorte.com.br'),
    ('CLI-004', 'Café Premium Export Ltda.', '94.444.444/0001-94', 'Vitória', 'ES', '(27) 3300-4000', 'export@cafePremium.com.br'),
    ('CLI-005', 'Armazém Geral Centro-Oeste', '95.555.555/0001-95', 'Rio Verde', 'GO', '(64) 3611-5000', 'armazem@cgomes.com.br'),
    ('CLI-006', 'Cooperativa Produtores Jataí', '96.666.666/0001-96', 'Jataí', 'GO', '(64) 3632-6000', 'comercial@coopjatai.coop.br'),
    ('CLI-007', 'Mercado Interno Grãos GO', '97.777.777/0001-97', 'Goiânia', 'GO', '(62) 3200-7000', 'vendas@migrãosgo.com.br'),
    ('CLI-008', 'Usina Etanol Cana Verde', '98.888.888/0001-98', 'Rio Verde', 'GO', '(64) 3611-8000', 'compras@canaverde.com.br'),
    ('CLI-009', 'Distribuidora Feijão Brasil', '99.999.999/0001-99', 'Brasília', 'DF', '(61) 3200-9000', 'pedidos@feijaobrasil.com.br'),
    ('CLI-010', 'Cerealista Planalto Central', '10.010.101/0001-10', 'Anápolis', 'GO', '(62) 3200-1010', 'compras@cerealista.com.br');

-- Insumos (35)
INSERT INTO insumos (codigo, nome, categoria_id, unidade_medida_id, principio_ativo, registro_mapa) VALUES
    ('INS-001', 'Glifosato 480 SL', 1, 2, 'Glifosato', 'MAP-001'),
    ('INS-002', '2,4-D Amine 806', 1, 2, '2,4-D', 'MAP-002'),
    ('INS-003', 'Atrazina 500 SC', 1, 2, 'Atrazina', 'MAP-003'),
    ('INS-004', 'Lambda-Cialotrina 50 EC', 1, 2, 'Lambda-Cialotrina', 'MAP-004'),
    ('INS-005', 'Clorimuron 250 WG', 1, 1, 'Clorimuron', 'MAP-005'),
    ('INS-006', 'Fomesafem 250 EC', 1, 2, 'Fomesafem', 'MAP-006'),
    ('INS-007', 'Trifluralina 440 EC', 1, 2, 'Trifluralina', 'MAP-007'),
    ('INS-008', 'Mancozeb 800 WP', 1, 1, 'Mancozeb', 'MAP-008'),
    ('INS-009', 'Azoxistrobina + Ciproconazol', 1, 2, 'Azoxistrobina', 'MAP-009'),
    ('INS-010', 'Imidacloprid 200 SL', 1, 2, 'Imidacloprid', 'MAP-010'),
    ('INS-011', 'Ureia 45% N', 2, 1, 'Nitrogênio', NULL),
    ('INS-012', 'Superfosfato Simples', 2, 1, 'Fósforo', NULL),
    ('INS-013', 'Cloreto de Potássio 60%', 2, 1, 'Potássio', NULL),
    ('INS-014', 'MAP 11-52-00', 2, 1, 'NPK', NULL),
    ('INS-015', 'KCl Granulado', 2, 1, 'Potássio', NULL),
    ('INS-016', 'NPK 08-28-16', 2, 1, 'NPK', NULL),
    ('INS-017', 'Sulfato de Amônio', 2, 1, 'Nitrogênio', NULL),
    ('INS-018', 'Micronutrientes Foliar', 2, 2, 'Micro', NULL),
    ('INS-019', 'Calcário Dolomítico PRNT 85', 4, 1, 'Ca+Mg', NULL),
    ('INS-020', 'Gesso Agrícola', 4, 1, 'Enxofre', NULL),
    ('INS-021', 'Semente Soja BMX Potência RR', 3, 1, NULL, NULL),
    ('INS-022', 'Semente Milho AG 8088 PRO3', 3, 1, NULL, NULL),
    ('INS-023', 'Semente Sorgo BRS 655', 3, 1, NULL, NULL),
    ('INS-024', 'Semente Feijão BRS Estilo', 3, 1, NULL, NULL),
    ('INS-025', 'Muda Café Arábica', 3, 5, NULL, NULL),
    ('INS-026', 'Óleo Mineral', 5, 2, 'Adjuvante', NULL),
    ('INS-027', 'Espalhante Adesivo', 5, 2, 'Adjuvante', NULL),
    ('INS-028', 'Inoculante Bradyrhizobium', 3, 7, 'Inoculante', NULL),
    ('INS-029', 'Herbicida Dicamba 480 SL', 1, 2, 'Dicamba', 'MAP-011'),
    ('INS-030', 'Fungicida Protioconazol', 1, 2, 'Protioconazol', 'MAP-012'),
    ('INS-031', 'Inseticida Tiametoxam', 1, 2, 'Tiametoxam', 'MAP-013'),
    ('INS-032', 'Fertilizante Foliar NPK', 2, 2, 'NPK', NULL),
    ('INS-033', 'Bioestimulante Algas', 2, 2, 'Bioestimulante', NULL),
    ('INS-034', 'Herbicida S-Metolaclore', 1, 2, 'S-Metolaclore', 'MAP-014'),
    ('INS-035', 'Regulador Crescimento', 1, 2, 'Trinexapac', 'MAP-015');

-- Lotes de insumo (amostra inicial)
INSERT INTO lotes_insumo (insumo_id, fornecedor_id, numero_lote, data_fabricacao, data_validade, quantidade_inicial, custo_unitario) VALUES
    (1, 4, 'LOT-G001', '2024-06-01', '2026-06-01', 5000.0000, 18.50),
    (11, 5, 'LOT-U001', '2024-08-01', '2026-08-01', 80000.0000, 2.80),
    (14, 5, 'LOT-MAP01', '2024-07-01', '2026-07-01', 50000.0000, 3.20),
    (21, 3, 'LOT-SBMX', '2024-09-01', '2025-09-01', 12000.0000, 85.00),
    (22, 3, 'LOT-M8088', '2024-10-01', '2025-10-01', 8000.0000, 420.00),
    (19, 5, 'LOT-CAL01', '2024-05-01', '2027-05-01', 200000.0000, 0.35),
    (6, 4, 'LOT-FOM01', '2024-07-15', '2026-07-15', 3000.0000, 45.00),
    (9, 4, 'LOT-AZO01', '2024-08-15', '2026-08-15', 2500.0000, 95.00);

-- Estoque insumos inicial
INSERT INTO estoque_insumos (armazem_id, lote_insumo_id, quantidade_atual) VALUES
    (1, 1, 3200.0000), (1, 2, 65000.0000), (1, 3, 42000.0000),
    (1, 4, 8500.0000), (1, 5, 5200.0000), (1, 6, 180000.0000),
    (1, 7, 2100.0000), (1, 8, 1800.0000);

-- Categorias equipamento
INSERT INTO categorias_equipamento (codigo, nome, tipo) VALUES
    ('CAT-TRAT', 'Trator', 'trator'),
    ('CAT-COLH', 'Colheitadeira', 'colheitadeira'),
    ('CAT-PULV', 'Pulverizador', 'pulverizador'),
    ('CAT-PLANT', 'Plantadeira', 'plantadeira'),
    ('CAT-CAM', 'Caminhão', 'caminhao'),
    ('CAT-IMP', 'Implemento', 'implemento');

-- Equipamentos (12)
INSERT INTO equipamentos (codigo, nome, categoria_id, marca, modelo, ano_fabricacao, horimetro_atual, status) VALUES
    ('EQ-TR01', 'Trator John Deere 7230R', 1, 'John Deere', '7230R', 2020, 4520.50, 'disponivel'),
    ('EQ-TR02', 'Trator Case IH Puma 185', 1, 'Case IH', 'Puma 185', 2019, 5100.00, 'disponivel'),
    ('EQ-TR03', 'Trator Valtra BH194i', 1, 'Valtra', 'BH194i', 2021, 3200.75, 'em_uso'),
    ('EQ-CO01', 'Colheitadeira John Deere S790', 2, 'John Deere', 'S790', 2022, 1850.00, 'disponivel'),
    ('EQ-CO02', 'Colheitadeira Case IH 8250', 2, 'Case IH', '8250', 2021, 2100.50, 'disponivel'),
    ('EQ-PU01', 'Pulverizador Jacto Uniport 3030', 3, 'Jacto', 'Uniport 3030', 2020, 2800.00, 'disponivel'),
    ('EQ-PU02', 'Pulverizador Stara Imperador 3000', 3, 'Stara', 'Imperador 3000', 2023, 950.00, 'disponivel'),
    ('EQ-PL01', 'Plantadeira Semeato PSE 8', 4, 'Semeato', 'PSE 8', 2019, 1200.00, 'disponivel'),
    ('EQ-PL02', 'Plantadeira Jumil JM 8090', 4, 'Jumil', 'JM 8090', 2022, 680.00, 'disponivel'),
    ('EQ-CA01', 'Caminhão Mercedes-Benz 2729', 5, 'Mercedes-Benz', '2729', 2018, 89000.00, 'disponivel'),
    ('EQ-CA02', 'Caminhão Volvo VM 330', 5, 'Volvo', 'VM 330', 2020, 62000.00, 'disponivel'),
    ('EQ-IM01', 'Grade Niveladora 48 discos', 6, 'Tatu', 'GCR 48', 2017, 800.00, 'disponivel');

-- Cargos
INSERT INTO cargos (codigo, nome, salario_base) VALUES
    ('CAR-OP', 'Operador de Máquinas', 4500.00),
    ('CAR-MEC', 'Mecânico Agrícola', 5200.00),
    ('CAR-AGRO', 'Agrônomo', 8500.00),
    ('CAR-ADM', 'Administrativo', 3800.00),
    ('CAR-FIN', 'Analista Financeiro', 6200.00),
    ('CAR-EST', 'Estoquista', 3200.00),
    ('CAR-MOT', 'Motorista', 4000.00),
    ('CAR-SUP', 'Supervisor de Campo', 5800.00);

-- Colaboradores (18)
INSERT INTO colaboradores (codigo, nome, cpf, cargo_id, data_admissao, status, telefone) VALUES
    ('COL-001', 'Carlos Eduardo Silva', '111.111.111-11', 1, '2018-03-15', 'ativo', '(64) 99901-0001'),
    ('COL-002', 'Roberto Almeida Santos', '222.222.222-22', 1, '2019-06-01', 'ativo', '(64) 99901-0002'),
    ('COL-003', 'Fernando Oliveira Costa', '333.333.333-33', 1, '2020-01-10', 'ativo', '(64) 99901-0003'),
    ('COL-004', 'Marcos Pereira Lima', '444.444.444-44', 1, '2017-08-20', 'ativo', '(64) 99901-0004'),
    ('COL-005', 'João Pedro Ferreira', '555.555.555-55', 2, '2016-05-12', 'ativo', '(64) 99901-0005'),
    ('COL-006', 'Antonio Carlos Souza', '666.666.666-66', 2, '2019-11-03', 'ativo', '(64) 99901-0006'),
    ('COL-007', 'Dra. Ana Paula Mendes', '777.777.777-77', 3, '2015-02-01', 'ativo', '(64) 99901-0007'),
    ('COL-008', 'Dr. Ricardo Nunes', '888.888.888-88', 3, '2021-07-15', 'ativo', '(64) 99901-0008'),
    ('COL-009', 'Patricia Gomes Rocha', '999.999.999-99', 4, '2018-09-01', 'ativo', '(64) 99901-0009'),
    ('COL-010', 'Lucas Martins Dias', '101.010.101-01', 5, '2020-04-20', 'ativo', '(64) 99901-0010'),
    ('COL-011', 'Juliana Costa Barbosa', '202.020.202-02', 6, '2019-02-14', 'ativo', '(64) 99901-0011'),
    ('COL-012', 'Paulo Henrique Dias', '303.030.303-03', 7, '2017-12-01', 'ativo', '(64) 99901-0012'),
    ('COL-013', 'Eduardo Ramos Vieira', '404.040.404-04', 7, '2022-03-10', 'ativo', '(64) 99901-0013'),
    ('COL-014', 'Marcelo Henrique Alves', '505.050.505-05', 8, '2016-01-15', 'ativo', '(64) 99901-0014'),
    ('COL-015', 'Felipe Augusto Nery', '606.060.606-06', 1, '2023-08-01', 'ativo', '(64) 99901-0015'),
    ('COL-016', 'Gabriel Santos Moura', '707.070.707-07', 1, '2024-01-15', 'ativo', '(64) 99901-0016'),
    ('COL-017', 'Renata Oliveira Pinto', '808.080.808-08', 4, '2021-11-01', 'ativo', '(64) 99901-0017'),
    ('COL-018', 'Bruno Carvalho Ribeiro', '909.090.909-09', 6, '2022-06-20', 'ativo', '(64) 99901-0018');

-- Equipes
INSERT INTO equipes (codigo, nome, lider_id, unidade_produtiva_id) VALUES
    ('EQP-01', 'Equipe Plantio Norte', 14, 1),
    ('EQP-02', 'Equipe Pulverização', 14, 1),
    ('EQP-03', 'Equipe Colheita', 4, 1),
    ('EQP-04', 'Equipe Café', 14, 2);

-- Operações agrícolas
INSERT INTO operacoes_agricolas (codigo, nome, tipo, descricao) VALUES
    ('OP-PREP', 'Preparo de Solo', 'preparo_solo', 'Gradagem e nivelamento'),
    ('OP-PLANT', 'Plantio', 'plantio', 'Semeadura direta'),
    ('OP-ADUB', 'Adubação de Base', 'adubacao', 'Aplicação NPK'),
    ('OP-ADUBC', 'Adubação de Cobertura', 'adubacao', 'Cobertura nitrogenada'),
    ('OP-HERB', 'Herbicida Pré-emergente', 'pulverizacao', 'Controle invasoras'),
    ('OP-HERBP', 'Herbicida Pós-emergente', 'pulverizacao', 'Dessecação'),
    ('OP-FUNG', 'Fungicida', 'pulverizacao', 'Controle doenças foliares'),
    ('OP-INSET', 'Inseticida', 'pulverizacao', 'Controle pragas'),
    ('OP-COLH', 'Colheita', 'colheita', 'Colheita mecanizada'),
    ('OP-BENEF', 'Beneficiamento', 'beneficiamento', 'Secagem e limpeza'),
    ('OP-CALC', 'Calagem', 'adubacao', 'Correção pH solo'),
    ('OP-GIPS', 'Gessagem', 'adubacao', 'Correção enxofre subsolo');

-- Centros de custo
INSERT INTO centros_custo (codigo, nome, unidade_produtiva_id) VALUES
    ('CC-GRAOS', 'Centro Custo Grãos', 1),
    ('CC-CAFE', 'Centro Custo Café', 2),
    ('CC-ADM', 'Centro Custo Administrativo', NULL),
    ('CC-MAN', 'Centro Custo Manutenção', NULL);

-- Categorias financeiras
INSERT INTO categorias_financeiras (codigo, nome, tipo, grupo) VALUES
    ('CF-VENDA', 'Venda de Produção', 'receita', 'operacional'),
    ('CF-SERV', 'Prestação de Serviços', 'receita', 'operacional'),
    ('CF-INS', 'Compra de Insumos', 'despesa', 'operacional'),
    ('CF-COMB', 'Combustível', 'despesa', 'operacional'),
    ('CF-MAN', 'Manutenção Equipamentos', 'despesa', 'operacional'),
    ('CF-RH', 'Folha de Pagamento', 'despesa', 'pessoal'),
    ('CF-ADM', 'Despesas Administrativas', 'despesa', 'administrativo'),
    ('CF-FIN', 'Despesas Financeiras', 'despesa', 'financeiro'),
    ('CF-ARREND', 'Arrendamento', 'despesa', 'operacional'),
    ('CF-OUTREC', 'Outras Receitas', 'receita', 'outras');

-- Contas bancárias
INSERT INTO contas_bancarias (codigo, banco, agencia, conta, tipo, saldo_atual) VALUES
    ('CB-BB', 'Banco do Brasil', '1234-5', '56789-0', 'corrente', 1250000.00),
    ('CB-SIC', 'Sicredi', '0810', '12345-6', 'corrente', 380000.00),
    ('CB-APL', 'Banco do Brasil', '1234-5', '56790-1', 'aplicacao', 2500000.00);

-- Plano de contas agrícola
INSERT INTO plano_contas (codigo, nome, tipo, natureza, conta_pai_id, nivel, analitica) VALUES
    ('1', 'ATIVO', 'ativo', 'devedora', NULL, 1, FALSE),
    ('1.1', 'ATIVO CIRCULANTE', 'ativo', 'devedora', 1, 2, FALSE),
    ('1.1.01', 'Caixa e Equivalentes', 'ativo', 'devedora', 2, 3, FALSE),
    ('1.1.01.001', 'Banco Conta Corrente BB', 'ativo', 'devedora', 3, 4, TRUE),
    ('1.1.01.002', 'Banco Conta Corrente Sicredi', 'ativo', 'devedora', 3, 4, TRUE),
    ('1.1.02', 'Estoques', 'ativo', 'devedora', 2, 3, FALSE),
    ('1.1.02.001', 'Estoque de Insumos', 'ativo', 'devedora', 6, 4, TRUE),
    ('1.1.02.002', 'Estoque de Produção', 'ativo', 'devedora', 6, 4, TRUE),
    ('1.1.03', 'Contas a Receber', 'ativo', 'devedora', 2, 3, TRUE),
    ('1.2', 'ATIVO NÃO CIRCULANTE', 'ativo', 'devedora', 1, 2, FALSE),
    ('1.2.01', 'Imobilizado', 'ativo', 'devedora', 10, 3, FALSE),
    ('1.2.01.001', 'Máquinas e Equipamentos', 'ativo', 'devedora', 11, 4, TRUE),
    ('2', 'PASSIVO', 'passivo', 'credora', NULL, 1, FALSE),
    ('2.1', 'PASSIVO CIRCULANTE', 'passivo', 'credora', 13, 2, FALSE),
    ('2.1.01', 'Contas a Pagar', 'passivo', 'credora', 14, 3, TRUE),
    ('2.1.02', 'Empréstimos CP', 'passivo', 'credora', 14, 3, TRUE),
    ('3', 'PATRIMÔNIO LÍQUIDO', 'patrimonio', 'credora', NULL, 1, FALSE),
    ('3.1', 'Capital Social', 'patrimonio', 'credora', 17, 2, TRUE),
    ('3.2', 'Lucros Acumulados', 'patrimonio', 'credora', 17, 2, TRUE),
    ('4', 'RECEITAS', 'receita', 'credora', NULL, 1, FALSE),
    ('4.1', 'Receita Operacional Bruta', 'receita', 'credora', 20, 2, FALSE),
    ('4.1.01', 'Venda Soja', 'receita', 'credora', 21, 3, TRUE),
    ('4.1.02', 'Venda Milho', 'receita', 'credora', 21, 3, TRUE),
    ('4.1.03', 'Venda Sorgo', 'receita', 'credora', 21, 3, TRUE),
    ('4.1.04', 'Venda Feijão', 'receita', 'credora', 21, 3, TRUE),
    ('4.1.05', 'Venda Café', 'receita', 'credora', 21, 3, TRUE),
    ('5', 'DESPESAS', 'despesa', 'devedora', NULL, 1, FALSE),
    ('5.1', 'Custos da Produção', 'despesa', 'devedora', 27, 2, FALSE),
    ('5.1.01', 'Insumos Agrícolas', 'despesa', 'devedora', 28, 3, TRUE),
    ('5.1.02', 'Combustível', 'despesa', 'devedora', 28, 3, TRUE),
    ('5.1.03', 'Mão de Obra Direta', 'despesa', 'devedora', 28, 3, TRUE),
    ('5.1.04', 'Depreciação Máquinas', 'despesa', 'devedora', 28, 3, TRUE),
    ('5.2', 'Despesas Operacionais', 'despesa', 'devedora', 27, 2, FALSE),
    ('5.2.01', 'Despesas Administrativas', 'despesa', 'devedora', 33, 3, TRUE),
    ('5.2.02', 'Despesas Financeiras', 'despesa', 'devedora', 33, 3, TRUE);

-- Históricos padrão
INSERT INTO historicos_padrao (codigo, descricao) VALUES
    ('HP01', 'Compra de insumos agrícolas'),
    ('HP02', 'Venda de produção agrícola'),
    ('HP03', 'Pagamento de folha de pagamento'),
    ('HP04', 'Depreciação mensal de equipamentos'),
    ('HP05', 'Recebimento de clientes'),
    ('HP06', 'Pagamento a fornecedores'),
    ('HP07', 'Aplicação de fertilizantes'),
    ('HP08', 'Consumo de combustível'),
    ('HP09', 'Manutenção de equipamentos'),
    ('HP10', 'Ajuste de estoque');

-- Análises de solo (amostra)
INSERT INTO analises_solo (talhao_id, data_coleta, laboratorio, ph, materia_organica_pct, fosforo_ppm, potassio_ppm, calcio_cmol, magnesio_cmol, recomendacao)
SELECT t.id, '2024-03-15', 'Laboratório Solo Análise', 5.8 + (t.id % 5) * 0.1, 2.5 + (t.id % 3) * 0.3,
       12.0 + t.id, 85.0 + t.id * 2, 3.5, 1.2, 'Calagem recomendada conforme análise'
FROM talhoes t WHERE t.unidade_produtiva_id = 1 LIMIT 10;

-- Custo hora equipamento (safra 2024/25)
INSERT INTO custo_hora_equipamento (equipamento_id, safra_id, custo_hora, vigencia_inicio) VALUES
    (1, 2, 285.00, '2024-09-01'), (2, 2, 270.00, '2024-09-01'), (4, 2, 850.00, '2024-09-01'),
    (6, 2, 320.00, '2024-09-01'), (8, 2, 180.00, '2024-09-01'), (1, 3, 295.00, '2025-09-01');

-- Custo hora colaborador (safra 2024/25)
INSERT INTO custo_hora_colaborador (colaborador_id, safra_id, custo_hora, vigencia_inicio) VALUES
    (1, 2, 35.00, '2024-09-01'), (2, 2, 32.00, '2024-09-01'), (3, 2, 34.00, '2024-09-01'),
    (4, 2, 38.00, '2024-09-01'), (7, 2, 65.00, '2024-09-01'), (14, 2, 48.00, '2024-09-01');
