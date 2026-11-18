import { createClient } from '@neondatabase/neon-js';
import { NEON_AUTH_URL, NEON_DATA_API_URL } from './config.js';

const AUTH_URL = NEON_AUTH_URL;
const DATA_API_URL = NEON_DATA_API_URL;
const authGate = document.getElementById('authGate');
const shell = document.querySelector('.shell');
const message = document.getElementById('authMessage');
const form = document.getElementById('signInForm');

const ROLE_LABELS = {
  president: 'Presidência',
  vice_president: 'Vice-presidência',
  treasurer: 'Tesouraria',
  secretary: 'Secretaria',
  director: 'Diretoria',
  administrator: 'Administrador'
};

const MODULES = [
  { section: 'associados', table: 'associates', title: 'Associados', columns: ['membership_number','full_name','email','phone','city','state','category','status'], fields: [
    ['full_name','Nome completo','text',true],['email','E-mail','email'],['phone','Telefone','tel'],['city','Cidade','text'],['state','UF','text'],['professional_registration','Registro profissional','text'],['category','Categoria','text'],['joined_at','Data de filiação','date'],['status','Situação','select',['pending','active','suspended','resigned','excluded']]
  ]},
  { section: 'diretoria', table: 'board_members', title: 'Diretoria e mandatos', columns: ['full_name','office','term_start','term_end','status'], fields: [
    ['full_name','Nome completo','text',true],['office','Cargo','text',true],['term_start','Início do mandato','date',true],['term_end','Fim do mandato','date'],['status','Situação','select',false,['active','ended','revoked']]
  ]},
  { section: 'financeiro', table: 'financial_entries', title: 'Movimentações financeiras', columns: ['entry_type','description','amount','competence_date','category','status'], fields: [
    ['entry_type','Tipo','select',true,['income','expense']],['description','Descrição','text',true],['amount','Valor (R$)','number',true],['competence_date','Competência','date',true],['due_date','Vencimento','date'],['category','Categoria','text'],['payment_method','Forma de pagamento','text'],['status','Situação','select',false,['pending','paid','cancelled','overdue']]
  ]},
  { section: 'secretaria', table: 'protocols', title: 'Protocolos', columns: ['protocol_number','direction','subject','sender','recipient','received_at','status'], fields: [
    ['protocol_number','Número do protocolo','text',true],['direction','Fluxo','select',true,['incoming','outgoing','internal']],['subject','Assunto','text',true],['sender','Remetente','text'],['recipient','Destinatário','text'],['due_date','Prazo','date'],['status','Situação','select',false,['open','in_progress','answered','archived']],['notes','Observações','textarea']
  ]},
  { section: 'documentos', table: 'official_documents', title: 'Documentos oficiais', columns: ['title','document_type','document_number','version','issued_at','expires_at','confidentiality'], fields: [
    ['title','Título','text',true],['document_type','Tipo documental','text',true],['document_number','Número','text'],['issued_at','Data de emissão','date'],['expires_at','Validade','date'],['confidentiality','Classificação','select',false,['public','internal','restricted','confidential']],['storage_path','Referência do arquivo','text']
  ]},
  { section: 'juridico', table: 'legal_cases', title: 'Demandas jurídicas', columns: ['title','case_number','institution','status','deadline'], fields: [
    ['title','Título','text',true],['case_number','Número do processo','text'],['institution','Órgão/Instituição','text'],['deadline','Prazo','date'],['status','Situação','select',false,['open','monitoring','closed','suspended']],['summary','Resumo','textarea']
  ]},
  { section: 'representacao', table: 'institutional_relations', title: 'Relações institucionais', columns: ['institution','contact_name','subject','next_action_at','status'], fields: [
    ['institution','Instituição','text',true],['contact_name','Contato','text'],['subject','Assunto','text'],['next_action_at','Próxima ação','date'],['status','Situação','select',false,['active','paused','closed']],['notes','Observações','textarea']
  ]},
  { section: 'reunioes', table: 'meetings', title: 'Reuniões e agenda', columns: ['title','meeting_type','starts_at','ends_at','location','status'], fields: [
    ['title','Título','text',true],['meeting_type','Tipo','text'],['starts_at','Início','datetime-local',true],['ends_at','Término','datetime-local'],['location','Local','text'],['agenda','Pauta','textarea'],['status','Situação','select',false,['scheduled','held','cancelled']]
  ]},
  { section: 'comunicacao', table: 'communications', title: 'Comunicação institucional', columns: ['title','channel','audience','scheduled_at','status'], fields: [
    ['title','Título','text',true],['channel','Canal','text'],['audience','Público','text'],['body','Conteúdo','textarea'],['scheduled_at','Agendamento','datetime-local'],['status','Situação','select',false,['draft','scheduled','published','cancelled']]
  ]},
  { section: 'demandas', table: 'member_demands', title: 'Demandas dos associados', columns: ['subject','priority','status','due_date','responsible_user_id'], fields: [
    ['subject','Assunto','text',true],['description','Descrição','textarea'],['priority','Prioridade','select',false,['low','normal','high','urgent']],['status','Situação','select',false,['open','in_progress','waiting','resolved','closed']],['due_date','Prazo','date']
  ]}
];

let neon;
let currentUser;
let currentProfile;

function showMessage(text, kind = 'error') {
  message.textContent = text;
  message.dataset.kind = kind;
  message.hidden = false;
}

function clearMessage() {
  message.hidden = true;
  message.textContent = '';
}

function roleAllowed(section, role) {
  if (role === 'administrator' || role === 'president') return true;
  const access = {
    vice_president: ['dashboard','associados','diretoria','financeiro','secretaria','documentos','juridico','representacao','reunioes','comunicacao','demandas','relatorios'],
    treasurer: ['dashboard','associados','diretoria','financeiro','documentos','relatorios'],
    secretary: ['dashboard','associados','diretoria','secretaria','documentos','reunioes','comunicacao','demandas','relatorios'],
    director: ['dashboard','associados','diretoria','financeiro','secretaria','documentos','juridico','representacao','reunioes','demandas','relatorios']
  };
  return (access[role] || []).includes(section);
}

function applyRoleVisibility(role) {
  document.querySelectorAll('[data-section]').forEach(button => {
    const section = button.dataset.section;
    button.hidden = !roleAllowed(section, role);
  });
  document.querySelectorAll('[data-go]').forEach(button => {
    const section = button.dataset.go;
    button.hidden = !roleAllowed(section, role);
  });
  const status = document.querySelector('.status');
  if (status) status.textContent = ROLE_LABELS[role] || 'Acesso restrito';
  const avatar = document.querySelector('.avatar');
  if (avatar) avatar.textContent = (currentProfile.full_name || currentUser.email || 'A').trim().charAt(0).toUpperCase();
  const crumb = document.querySelector('.crumb');
  if (crumb && !document.getElementById('signOutButton')) {
    const button = document.createElement('button');
    button.id = 'signOutButton';
    button.className = 'btn btn-light';
    button.type = 'button';
    button.textContent = 'Sair';
    button.addEventListener('click', async () => {
      await neon.auth.signOut();
      window.location.reload();
    });
    crumb.parentElement.appendChild(button);
  }
}

function addDataPanel(module) {
  const section = document.getElementById(module.section);
  if (!section) return;
  const panel = document.createElement('div');
  panel.className = 'panel anit-data-panel';
  panel.id = 'data-' + module.table;
  panel.innerHTML = '<div class="panel-head"><h2></h2><span class="muted">Dados protegidos pela ANIT</span></div><div class="anit-form-wrap"></div><div class="anit-table-wrap"></div><p class="anit-feedback" role="status"></p>';
  panel.querySelector('h2').textContent = module.title;
  section.appendChild(panel);
  const formWrap = panel.querySelector('.anit-form-wrap');
  const createForm = document.createElement('form');
  createForm.className = 'field-grid anit-create-form';
  const allowedToCreate = canManage(module.table, currentProfile.role);
  if (allowedToCreate) {
    module.fields.forEach(([name,label,type,required,options]) => {
      const field = document.createElement('div');
      field.className = 'field';
      const lab = document.createElement('label');
      lab.textContent = label;
      lab.htmlFor = module.table + '-' + name;
      field.appendChild(lab);
      let input;
      if (type === 'select') {
        input = document.createElement('select');
        (options || []).forEach(value => {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = value;
          input.appendChild(option);
        });
      } else if (type === 'textarea') {
        input = document.createElement('textarea');
      } else {
        input = document.createElement('input');
        input.type = type || 'text';
      }
      input.id = module.table + '-' + name;
      input.name = name;
      if (required) input.required = true;
      field.appendChild(input);
      createForm.appendChild(field);
    });
    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'btn btn-primary';
    submit.textContent = 'Salvar registro';
    createForm.appendChild(submit);
    createForm.addEventListener('submit', async event => {
      event.preventDefault();
      const feedback = panel.querySelector('.anit-feedback');
      const payload = Object.fromEntries(new FormData(createForm).entries());
      Object.keys(payload).forEach(key => {
        if (payload[key] === '') delete payload[key];
        if (['amount'].includes(key) && payload[key] !== undefined) payload[key] = Number(payload[key]);
      });
      if (module.table === 'associates') payload.created_by = currentUser.id;
      if (module.table === 'financial_entries') payload.created_by = currentUser.id;
      if (module.table === 'protocols') payload.created_by = currentUser.id;
      const { error } = await neon.from(module.table).insert(payload);
      if (error) {
        feedback.textContent = 'Não foi possível salvar: ' + error.message;
        feedback.dataset.kind = 'error';
        return;
      }
      feedback.textContent = 'Registro salvo. A operação foi encaminhada à trilha de auditoria.';
      feedback.dataset.kind = 'success';
      createForm.reset();
      await loadTable(module);
    });
    formWrap.appendChild(createForm);
  } else {
    const note = document.createElement('p');
    note.className = 'muted';
    note.textContent = 'Seu perfil tem acesso de consulta a esta área. Alterações são reservadas às funções autorizadas.';
    formWrap.appendChild(note);
  }
  loadTable(module);
}

function canManage(table, role) {
  if (role === 'administrator' || role === 'president') return true;
  const rules = {
    associates: ['vice_president','secretary'],
    financial_entries: ['treasurer'],
    protocols: ['vice_president','secretary'],
    official_documents: ['secretary'],
    board_members: [],
    legal_cases: [],
    institutional_relations: [],
    meetings: ['vice_president','secretary'],
    communications: ['secretary'],
    member_demands: ['vice_president','secretary']
  };
  return (rules[table] || []).includes(role);
}

async function loadTable(module) {
  const panel = document.getElementById('data-' + module.table);
  if (!panel) return;
  const wrap = panel.querySelector('.anit-table-wrap');
  wrap.textContent = 'Carregando registros...';
  const { data, error } = await neon.from(module.table)
    .select(module.columns.join(','))
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) {
    wrap.textContent = 'Consulta indisponível para este perfil ou módulo: ' + error.message;
    return;
  }
  if (!data?.length) {
    wrap.textContent = 'Nenhum registro cadastrado.';
    return;
  }
  const table = document.createElement('table');
  const head = document.createElement('thead');
  const headerRow = document.createElement('tr');
  module.columns.forEach(column => {
    const th = document.createElement('th');
    th.textContent = column.replaceAll('_',' ');
    headerRow.appendChild(th);
  });
  head.appendChild(headerRow);
  table.appendChild(head);
  const body = document.createElement('tbody');
  data.forEach(row => {
    const tr = document.createElement('tr');
    module.columns.forEach(column => {
      const td = document.createElement('td');
      td.textContent = row[column] == null ? '—' : String(row[column]);
      tr.appendChild(td);
    });
    body.appendChild(tr);
  });
  table.appendChild(body);
  const frame = document.createElement('div');
  frame.className = 'table-wrap';
  frame.appendChild(table);
  wrap.replaceChildren(frame);
}

async function loadProfile(user) {
  const { data, error } = await neon.from('user_profiles')
    .select('user_id,full_name,role,active')
    .eq('user_id', user.id)
    .single();
  if (error || !data || !data.active) {
    await neon.auth.signOut();
    throw new Error('Sua conta ainda não recebeu um perfil ativo da ANIT. Solicite ao administrador a liberação do acesso.');
  }
  return data;
}


async function loadDashboardStats() {
  const selectors = [...document.querySelectorAll('#dashboard .stat-value')];
  const cards = [
    { table: 'associates', filter: null, label: 'Associados cadastrados' },
    { table: 'financial_entries', filter: ['status','paid'], label: 'Movimentações pagas' },
    { table: 'member_demands', filter: ['status','open'], label: 'Demandas abertas' },
    { table: 'official_documents', filter: null, label: 'Documentos emitidos' }
  ];
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const node = selectors[i];
    if (!node || !roleAllowed(card.table === 'associates' ? 'associados' : card.table === 'financial_entries' ? 'financeiro' : card.table === 'member_demands' ? 'demandas' : 'documentos', currentProfile.role)) continue;
    let query = neon.from(card.table).select('id').limit(100);
    if (card.filter) query = query.eq(card.filter[0], card.filter[1]);
    const { data, error } = await query;
    if (!error) {
      node.textContent = data.length === 100 ? '100+' : String(data.length);
      const detail = node.parentElement.querySelector('small');
      if (detail) detail.textContent = 'Dados atuais do banco ANIT';
    } else {
      node.textContent = '—';
    }
  }
}

async function loadAudit() {
  const section = document.getElementById('usuarios');
  if (!section || !['administrator','president'].includes(currentProfile.role)) return;
  const panel = document.createElement('div');
  panel.className = 'panel anit-data-panel';
  panel.innerHTML = '<div class="panel-head"><h2>Trilha de auditoria</h2></div><div class="anit-table-wrap"></div>';
  section.appendChild(panel);
  const wrap = panel.querySelector('.anit-table-wrap');
  const { data, error } = await neon.from('audit_log')
    .select('action,table_name,record_id,changed_fields,occurred_at,actor_user_id')
    .order('occurred_at',{ascending:false}).limit(50);
  if (error) { wrap.textContent = 'Auditoria indisponível: ' + error.message; return; }
  if (!data?.length) { wrap.textContent = 'Nenhuma operação registrada até o momento.'; return; }
  const table = document.createElement('table');
  const head = document.createElement('tr');
  ['Data','Ação','Tabela','Registro','Campos alterados','Usuário'].forEach(label => {
    const th = document.createElement('th'); th.textContent = label; head.appendChild(th);
  });
  const thead = document.createElement('thead'); thead.appendChild(head); table.appendChild(thead);
  const tbody = document.createElement('tbody');
  data.forEach(row => {
    const tr = document.createElement('tr');
    [new Date(row.occurred_at).toLocaleString('pt-BR'),row.action,row.table_name,row.record_id,(row.changed_fields||[]).join(', '),row.actor_user_id].forEach(value => {
      const td=document.createElement('td'); td.textContent=value||'—'; tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  const frame=document.createElement('div'); frame.className='table-wrap'; frame.appendChild(table); wrap.replaceChildren(frame);
}


async function loadUsersAndPermissions() {
  if (!['administrator','president'].includes(currentProfile.role)) return;
  const section = document.getElementById('usuarios');
  if (!section) return;
  const usersPanel = document.createElement('div');
  usersPanel.className = 'panel anit-data-panel';
  usersPanel.innerHTML = '<div class="panel-head"><h2>Contas e perfis autorizados</h2><span class="muted">Acesso restrito</span></div><div class="anit-users-table"></div><p class="muted">A criação de novas contas é controlada pela administração. O cadastro público permanece desativado.</p>';
  section.appendChild(usersPanel);
  const usersWrap = usersPanel.querySelector('.anit-users-table');
  const { data: users, error: usersError } = await neon.from('user_profiles')
    .select('full_name,role,active,created_at')
    .order('created_at',{ascending:false}).limit(100);
  if (usersError) {
    usersWrap.textContent = 'Não foi possível consultar os perfis: ' + usersError.message;
  } else if (!users?.length) {
    usersWrap.textContent = 'Nenhum perfil institucional foi atribuído ainda.';
  } else {
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const trh = document.createElement('tr');
    ['Usuário','Função','Situação','Criado em'].forEach(label => {
      const th = document.createElement('th'); th.textContent = label; trh.appendChild(th);
    });
    thead.appendChild(trh); table.appendChild(thead);
    const tbody = document.createElement('tbody');
    users.forEach(user => {
      const tr = document.createElement('tr');
      [user.full_name,ROLE_LABELS[user.role] || user.role,user.active ? 'Ativo' : 'Inativo',new Date(user.created_at).toLocaleDateString('pt-BR')].forEach(value => {
        const td = document.createElement('td'); td.textContent = value || '—'; tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    const frame = document.createElement('div'); frame.className = 'table-wrap'; frame.appendChild(table); usersWrap.replaceChildren(frame);
  }

  const permissionsPanel = document.createElement('div');
  permissionsPanel.className = 'panel anit-data-panel';
  permissionsPanel.innerHTML = '<div class="panel-head"><h2>Matriz de permissões</h2></div><div class="anit-permissions-table"></div>';
  section.appendChild(permissionsPanel);
  const permissionsWrap = permissionsPanel.querySelector('.anit-permissions-table');
  const { data: permissions, error: permissionsError } = await neon.from('role_permissions')
    .select('role,permission_key,allowed').order('role',{ascending:true}).limit(200);
  if (permissionsError) {
    permissionsWrap.textContent = 'Não foi possível consultar a matriz: ' + permissionsError.message;
  } else if (!permissions?.length) {
    permissionsWrap.textContent = 'A matriz de permissões ainda não foi cadastrada.';
  } else {
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const trh = document.createElement('tr');
    ['Função','Permissão','Liberada'].forEach(label => {
      const th=document.createElement('th'); th.textContent=label; trh.appendChild(th);
    });
    thead.appendChild(trh); table.appendChild(thead);
    const tbody=document.createElement('tbody');
    permissions.forEach(item => {
      const tr=document.createElement('tr');
      [ROLE_LABELS[item.role] || item.role,item.permission_key,item.allowed ? 'Sim' : 'Não'].forEach(value => {
        const td=document.createElement('td'); td.textContent=value; tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    const frame=document.createElement('div'); frame.className='table-wrap'; frame.appendChild(table); permissionsWrap.replaceChildren(frame);
  }
}

async function boot() {
  if (!AUTH_URL || !DATA_API_URL) {
    showMessage('A configuração pública da autenticação e da API ainda não foi adicionada ao ambiente de hospedagem.');
    return;
  }
  neon = createClient({ auth: { url: AUTH_URL }, dataApi: { url: DATA_API_URL } });
  const { data, error } = await neon.auth.getSession();
  if (error || !data?.session || !data?.user) {
    authGate.hidden = false;
    shell.style.display = 'none';
    return;
  }
  currentUser = data.user;
  try {
    currentProfile = await loadProfile(currentUser);
  } catch (err) {
    showMessage(err.message);
    authGate.hidden = false;
    shell.style.display = 'none';
    return;
  }
  authGate.hidden = true;
  shell.style.display = 'grid';
  applyRoleVisibility(currentProfile.role);
  MODULES.filter(module => roleAllowed(module.section, currentProfile.role)).forEach(addDataPanel);
  await loadDashboardStats();
  await loadAudit();
  await loadUsersAndPermissions();
}

form?.addEventListener('submit', async event => {
  event.preventDefault();
  clearMessage();
  if (!neon) {
    if (!AUTH_URL || !DATA_API_URL) {
      showMessage('O ambiente ainda não está configurado para autenticação.');
      return;
    }
    neon = createClient({ auth: { url: AUTH_URL }, dataApi: { url: DATA_API_URL } });
  }
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const { error } = await neon.auth.signIn.email({ email, password, rememberMe: true });
  if (error) {
    showMessage('Não foi possível autenticar. Confira o e-mail e a senha ou solicite a recuperação.');
    return;
  }
  await boot();
});

document.getElementById('forgotPassword')?.addEventListener('click', async () => {
  clearMessage();
  if (!neon && AUTH_URL && DATA_API_URL) neon = createClient({ auth: { url: AUTH_URL }, dataApi: { url: DATA_API_URL } });
  const email = document.getElementById('loginEmail').value.trim();
  if (!email) {
    showMessage('Informe seu e-mail no campo acima para receber as instruções de recuperação.');
    return;
  }
  const basePath = window.location.pathname.replace(/admin\.html$/, '');
  const redirectTo = window.location.origin + basePath + 'auth.html?path=reset-password';
  const { error } = await neon.auth.requestPasswordReset({ email, redirectTo });
  if (error) {
    showMessage('Não foi possível enviar a recuperação. Verifique a configuração do serviço de e-mail ou contate o administrador.');
    return;
  }
  showMessage('Se o e-mail estiver cadastrado, as instruções de recuperação serão enviadas. Verifique também a caixa de spam.', 'success');
});

document.addEventListener('DOMContentLoaded', () => {
  const styles = document.createElement('style');
  styles.textContent = `
    .anit-data-panel{margin-top:18px}.anit-create-form{margin:8px 0 18px;padding:16px;border:1px solid var(--line);border-radius:12px;background:#f9fbfd}.anit-create-form .field{min-width:0}.anit-create-form button{justify-self:start}.anit-feedback{font-size:.82rem;color:var(--muted)}.anit-feedback[data-kind="error"]{color:#a83c3c}.anit-feedback[data-kind="success"]{color:#26734d}.anit-table-wrap{overflow:auto}.anit-table-wrap table{min-width:720px}
    #signOutButton{margin-left:12px}.nav button[hidden],[data-go][hidden]{display:none!important}
  `;
  document.head.appendChild(styles);
  boot().catch(err => showMessage(err.message || 'Falha ao iniciar a Central Administrativa.'));
});