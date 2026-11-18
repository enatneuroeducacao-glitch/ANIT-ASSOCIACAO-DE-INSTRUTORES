# ANIT — Associação Nacional de Instrutores de Trânsito

Site institucional e Central Administrativa da ANIT.

## Aplicação

- Site público em HTML, CSS e JavaScript.
- Central Administrativa protegida por Neon Managed Better Auth.
- Banco PostgreSQL exclusivo ANIT-ADMIN (Neon).
- Neon Data API com Row-Level Security (RLS).
- Perfis: Presidência, Vice-presidência, Tesouraria, Secretaria, Diretoria e Administrador.
- Auditoria automática de operações nas tabelas administrativas.
- Recuperação de senha por e-mail.
- Cadastro público de contas desativado; contas são provisionadas pela administração.

## Desenvolvimento local

1. Instale Node.js 20 ou superior.
2. Copie `.env.example` para `.env`.
3. Preencha apenas as URLs públicas de autenticação e Data API da Neon.
4. Execute `npm install`.
5. Execute `npm run dev`.

Nunca coloque senhas PostgreSQL, chaves secretas ou tokens administrativos em variáveis `VITE_*`, arquivos públicos ou no navegador.

## Publicação no GitHub Pages

O workflow `.github/workflows/pages.yml` compila o site com Vite e publica o conteúdo de `dist/` no GitHub Pages.

1. Abra **Settings → Pages** no repositório.
2. Em **Build and deployment**, escolha **GitHub Actions** como fonte.
3. Faça merge da branch de implantação em `main`.
4. O workflow publicará o site automaticamente.

URL prevista: `https://enatneuroeducacao-glitch.github.io/ANIT-ASSOCIACAO-DE-INSTRUTORES/`.

## Neon

Projeto: `ANIT-ADMIN`
Região: `aws-sa-east-1` (São Paulo)
Banco: `anit_admin`
Schema da aplicação: `anit`

A autenticação gerenciada usa Neon Better Auth. O Data API expõe somente o schema `anit`; permissões são aplicadas no PostgreSQL. Não conceder privilégios gerais a usuários anônimos.

## Perfis e autorização

- `president`: gestão institucional e supervisão.
- `vice_president`: associados, secretaria, reuniões e demandas.
- `treasurer`: leitura de associados e gestão financeira.
- `secretary`: associados, protocolos, documentos, reuniões, comunicação e demandas.
- `director`: consulta aos módulos institucionais autorizados.
- `administrator`: administração técnica e de acessos.

O acesso é validado no banco por políticas RLS. Ocultar módulos na interface não substitui as políticas do banco.

## Implantação pendente

- Configurar domínio de produção como trusted origin na Neon.
- Configurar SMTP institucional próprio para envio confiável de recuperação de senha.
- Criar a primeira conta de administrador/presidência e atribuir seu perfil.
- Validar os fluxos de login, recuperação, RLS e auditoria com contas de teste.
- Revisar política de privacidade, retenção e classificação documental antes de inserir dados reais.

## Segurança

Não cadastrar dados reais enquanto a primeira conta autorizada, o SMTP e os testes de homologação não estiverem concluídos.