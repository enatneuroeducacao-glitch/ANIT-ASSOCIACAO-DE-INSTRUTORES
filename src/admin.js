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
    ['received_at','Data de recebimento','datetime-local',true],['protocol_number','Número do protocolo','text',true],['direction','Fluxo','select',true,['incoming','outgoing','internal']],['subject','Assunto','text',true],['sender','Remetente','text'],['recipient','Destinatário','text'],['due_date','Prazo','date'],['status','Situação','select',false,['open','in_progress','answered','archived']],['notes','Observações','textarea']
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
  if (!section || document.getElementById('data-' + module.table)) return;
  section.querySelectorAll('.empty,.module-grid,.notice').forEach(node => node.remove());
  const panel = document.createElement('div');
  panel.className = 'panel anit-data-panel';
  panel.id = 'data-' + module.table;
  panel.innerHTML = '<div class="panel-head"><h2></h2><div class="anit-toolbar"><input class="anit-search" type="search" placeholder="Buscar registros"><button class="btn btn-light anit-refresh" type="button">Atualizar</button></div></div><div class="anit-form-wrap"></div><div class="anit-table-wrap"></div><p class="anit-feedback" role="status"></p>';
  panel.querySelector('h2').textContent = module.title;
  section.appendChild(panel);
  const formWrap = panel.querySelector('.anit-form-wrap');
  const createForm = document.createElement('form');
  createForm.className = 'field-grid anit-create-form';
  createForm.dataset.mode = 'create';
  const allowedToManage = canManage(module.table, currentProfile.role);
  let editingId = null;
  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'btn btn-primary';
  submit.textContent = 'Salvar registro';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'btn btn-light';
  cancel.textContent = 'Cancelar edição';
  cancel.hidden = true;
  cancel.addEventListener('click', () => {
    editingId = null;
    createForm.reset();
    createForm.dataset.mode = 'create';
    submit.textContent = 'Salvar registro';
    cancel.hidden = true;
    panel.querySelector('.anit-feedback').textContent = '';
  });
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
        option.textContent = value.replaceAll('_',' ');
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
  if (allowedToManage) {
    createForm.append(submit, cancel);
    createForm.addEventListener('submit', async event => {
      event.preventDefault();
      const feedback = panel.querySelector('.anit-feedback');
      const payload = Object.fromEntries(new FormData(createForm).entries());
      Object.keys(payload).forEach(key => {
        if (payload[key] === '') delete payload[key];
        if (['amount','version'].includes(key) && payload[key] !== undefined) payload[key] = Number(payload[key]);
        if (['starts_at','ends_at','scheduled_at','received_at','next_action_at','last_contact_at'].includes(key) && payload[key]) payload[key] = new Date(payload[key]).toISOString();
      });
      try {
        submit.disabled = true;
        if (editingId) {
          const { error } = await neon.from(module.table).update(payload).eq('id', editingId);
          if (error) throw error;
          feedback.textContent = 'Registro atualizado com sucesso.';
        } else {
          payload.created_by = currentUser.id;
          const { error } = await neon.from(module.table).insert(payload);
          if (error) throw error;
          feedback.textContent = 'Registro cadastrado com sucesso.';
        }
        feedback.dataset.kind = 'success';
        editingId = null;
        createForm.reset();
        createForm.dataset.mode = 'create';
        submit.textContent = 'Salvar registro';
        cancel.hidden = true;
        await loadTable(module);
      } catch (error) {
        feedback.textContent = 'Não foi possível salvar: ' + (error.message || 'erro desconhecido');
        feedback.dataset.kind = 'error';
      } finally {
        submit.disabled = false;
      }
    });
    formWrap.appendChild(createForm);
  } else {
    const note = document.createElement('p');
    note.className = 'muted';
    note.textContent = 'Seu perfil tem acesso de consulta nesta área. Edição e exclusão dependem das permissões institucionais.';
    formWrap.appendChild(note);
  }
  panel.querySelector('.anit-refresh').addEventListener('click', () => loadTable(module));
  panel.querySelector('.anit-search').addEventListener('input', () => loadTable(module));
  loadTable(module);

  panel._editRecord = row => {
    if (!allowedToManage) return;
    editingId = row.id;
    module.fields.forEach(([name]) => {
      const input = createForm.elements.namedItem(name);
      if (!input) return;
      let value = row[name] ?? '';
      if (input.type === 'datetime-local' && value) value = new Date(value).toISOString().slice(0,16);
      else if (input.type === 'date' && value) value = String(value).slice(0,10);
      input.value = value;
    });
    createForm.dataset.mode = 'edit';
    submit.textContent = 'Salvar alterações';
    cancel.hidden = false;
    createForm.scrollIntoView({behavior:'smooth',block:'center'});
  };
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
  const { data, error } = await neon.from(module.table).select('*').order('created_at', { ascending: false }).limit(250);
  if (error) {
    wrap.textContent = 'Consulta indisponível: ' + error.message;
    return;
  }
  const term = (panel.querySelector('.anit-search')?.value || '').trim().toLocaleLowerCase('pt-BR');
  const rows = (data || []).filter(row => !term || Object.values(row).some(value => String(value ?? '').toLocaleLowerCase('pt-BR').includes(term)));
  if (!rows.length) {
    wrap.textContent = data?.length ? 'Nenhum registro corresponde à busca.' : 'Nenhum registro cadastrado.';
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
  if (canManage(module.table,currentProfile.role)) {
    const th=document.createElement('th'); th.textContent='Ações'; headerRow.appendChild(th);
  }
  head.appendChild(headerRow); table.appendChild(head);
  const body = document.createElement('tbody');
  rows.forEach(row => {
    const tr = document.createElement('tr');
    module.columns.forEach(column => {
      const td = document.createElement('td');
      const value = row[column];
      td.textContent = value == null ? '—' : (typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value) ? new Date(value).toLocaleString('pt-BR') : String(value));
      tr.appendChild(td);
    });
    if (canManage(module.table,currentProfile.role)) {
      const actions=document.createElement('td');
      const edit=document.createElement('button');
      edit.type='button'; edit.className='btn btn-light btn-small'; edit.textContent='Editar';
      edit.addEventListener('click',()=>panel._editRecord(row));
      const del=document.createElement('button');
      del.type='button'; del.className='btn btn-danger btn-small'; del.textContent='Excluir';
      del.addEventListener('click',async()=>{
        if (!window.confirm('Confirma a exclusão deste registro? Esta ação ficará registrada na auditoria.')) return;
        const {error:deleteError}=await neon.from(module.table).delete().eq('id',row.id);
        const feedback=panel.querySelector('.anit-feedback');
        if(deleteError){feedback.textContent='Não foi possível excluir: '+deleteError.message;feedback.dataset.kind='error';return;}
        feedback.textContent='Registro excluído.';feedback.dataset.kind='success';await loadTable(module);
      });
      actions.append(edit,del); tr.appendChild(actions);
    }
    body.appendChild(tr);
  });
  table.appendChild(body);
  const frame=document.createElement('div'); frame.className='table-wrap'; frame.appendChild(table);
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
  const canAdministerUsers=currentProfile.role==='administrator';
  const section=document.getElementById('usuarios');
  if(!section || document.getElementById('anit-users-manager')) return;
  section.querySelectorAll('.notice,.role-list').forEach(node=>node.remove());
  const panel=document.createElement('div');
  panel.id='anit-users-manager';panel.className='panel anit-data-panel';
  panel.innerHTML='<div class="panel-head"><h2>Gerenciar contas e perfis</h2></div><p class="muted">A conta precisa existir primeiro no Neon Auth. Depois, informe o UUID do usuário para atribuir ou atualizar seu perfil institucional. Não compartilhe senhas.</p><form class="field-grid anit-create-form" id="anit-user-form"><div class="field"><label>UUID da conta Neon Auth</label><input name="user_id" required placeholder="UUID do usuário"></div><div class="field"><label>Nome completo</label><input name="full_name" required></div><div class="field"><label>Função institucional</label><select name="role"><option value="president">Presidência</option><option value="vice_president">Vice-presidência</option><option value="treasurer">Tesouraria</option><option value="secretary">Secretaria</option><option value="director">Diretoria</option><option value="administrator">Administrador</option></select></div><div class="field"><label>Situação</label><select name="active"><option value="true">Ativo</option><option value="false">Inativo</option></select></div><button class="btn btn-primary" type="submit">Salvar perfil</button></form><p class="anit-feedback" role="status"></p><div class="anit-users-table"></div>';
  section.appendChild(panel);
  const userForm=panel.querySelector('#anit-user-form');
  userForm?.addEventListener('submit',async event=>{
    event.preventDefault();
    const raw=Object.fromEntries(new FormData(userForm).entries());
    const feedback=panel.querySelector('.anit-feedback');
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw.user_id)){
      feedback.textContent='Informe um UUID válido da conta criada no Neon Auth.';feedback.dataset.kind='error';return;
    }
    if(raw.user_id===currentUser.id && raw.role!=='administrator'){
      feedback.textContent='Por segurança, não é permitido remover o perfil de administrador da sessão atual.';feedback.dataset.kind='error';return;
    }
    const payload={user_id:raw.user_id,full_name:raw.full_name.trim(),role:raw.role,active:raw.active==='true'};
    const {error}=await neon.from('user_profiles').upsert(payload,{onConflict:'user_id'});
    if(error){feedback.textContent='Não foi possível salvar o perfil: '+error.message;feedback.dataset.kind='error';return;}
    feedback.textContent='Perfil salvo. O usuário deverá entrar novamente para carregar as novas permissões.';feedback.dataset.kind='success';userForm.reset();await renderUsers();
  });
  async function renderUsers(){
    const wrap=panel.querySelector('.anit-users-table');
    const {data,error}=await neon.from('user_profiles').select('user_id,full_name,role,active,created_at').order('created_at',{ascending:false}).limit(200);
    if(error){wrap.textContent='Não foi possível consultar perfis: '+error.message;return;}
    const table=document.createElement('table');
    const thead=document.createElement('thead');const hr=document.createElement('tr');
    ['Nome','UUID','Função','Situação','Criado em','Ação'].forEach(x=>{const th=document.createElement('th');th.textContent=x;hr.appendChild(th);});
    thead.appendChild(hr);table.appendChild(thead);
    const tbody=document.createElement('tbody');
    (data||[]).forEach(user=>{
      const tr=document.createElement('tr');
      [user.full_name,user.user_id,ROLE_LABELS[user.role]||user.role,user.active?'Ativo':'Inativo',new Date(user.created_at).toLocaleDateString('pt-BR')].forEach(value=>{const td=document.createElement('td');td.textContent=value||'—';tr.appendChild(td);});
      const action=document.createElement('td');if(canAdministerUsers){const edit=document.createElement('button');edit.type='button';edit.className='btn btn-light btn-small';edit.textContent='Editar';edit.addEventListener('click',()=>{userForm.elements.user_id.value=user.user_id;userForm.elements.full_name.value=user.full_name;userForm.elements.role.value=user.role;userForm.elements.active.value=String(user.active);userForm.scrollIntoView({behavior:'smooth',block:'center'});});action.appendChild(edit);}else{action.textContent='Consulta';}tr.appendChild(action);tbody.appendChild(tr);
    });
    table.appendChild(tbody);const frame=document.createElement('div');frame.className='table-wrap';frame.appendChild(table);wrap.replaceChildren(frame);
  }
  await renderUsers();

  const permissionsPanel=document.createElement('div');permissionsPanel.className='panel anit-data-panel';
  permissionsPanel.innerHTML='<div class="panel-head"><h2>Matriz de permissões</h2><span class="muted">Alterações aplicadas no banco</span></div><div class="anit-permissions-table"></div>';
  section.appendChild(permissionsPanel);
  const permissionsWrap=permissionsPanel.querySelector('.anit-permissions-table');
  const {data:permissions,error:permissionsError}=await neon.from('role_permissions').select('id,role,permission_key,allowed').order('role').limit(300);
  if(permissionsError){permissionsWrap.textContent='Matriz indisponível: '+permissionsError.message;return;}
  const table=document.createElement('table');const thead=document.createElement('thead');const hr=document.createElement('tr');
  ['Função','Permissão','Liberada','Ação'].forEach(x=>{const th=document.createElement('th');th.textContent=x;hr.appendChild(th);});thead.appendChild(hr);table.appendChild(thead);
  const tbody=document.createElement('tbody');
  (permissions||[]).forEach(item=>{
    const tr=document.createElement('tr');
    [ROLE_LABELS[item.role]||item.role,item.permission_key,item.allowed?'Sim':'Não'].forEach(value=>{const td=document.createElement('td');td.textContent=value;tr.appendChild(td);});
    const action=document.createElement('td');const toggle=document.createElement('button');toggle.type='button';toggle.className='btn btn-light btn-small';toggle.textContent=item.allowed?'Revogar':'Liberar';
    toggle.addEventListener('click',async()=>{
      if(item.role==='administrator'&&item.permission_key==='*'&&item.allowed){window.alert('A permissão global do administrador não pode ser revogada por esta tela.');return;}
      const {error}=await neon.from('role_permissions').update({allowed:!item.allowed}).eq('id',item.id);
      if(error){window.alert('Não foi possível alterar: '+error.message);return;}
      item.allowed=!item.allowed;toggle.textContent=item.allowed?'Revogar':'Liberar';tr.children[2].textContent=item.allowed?'Sim':'Não';
    });
    if(currentProfile.role==='administrator') action.appendChild(toggle); else action.textContent='Consulta';tr.appendChild(action);tbody.appendChild(tr);
  });
  table.appendChild(tbody);const frame=document.createElement('div');frame.className='table-wrap';frame.appendChild(table);permissionsWrap.replaceChildren(frame);
}

async function loadReports() {
  const section=document.getElementById('relatorios');
  if(!section || document.getElementById('anit-reports')) return;
  section.querySelectorAll('.module-grid,.empty').forEach(node=>node.remove());
  const panel=document.createElement('div');panel.id='anit-reports';panel.className='panel anit-data-panel';
  panel.innerHTML='<div class="panel-head"><h2>Indicadores institucionais</h2><button type="button" class="btn btn-light">Atualizar relatórios</button></div><div class="anit-report-cards"></div><h3>Movimentação financeira por competência</h3><div class="anit-report-finance"></div><h3>Associados por situação</h3><div class="anit-report-members"></div>';
  section.appendChild(panel);
  const refresh=()=>renderReports(panel);
  panel.querySelector('button').addEventListener('click',refresh);
  await refresh();
}
async function renderReports(panel){
  const cards=panel.querySelector('.anit-report-cards');cards.textContent='Atualizando indicadores...';
  const [fin,assoc,demands,protocols]=await Promise.all([
    neon.from('financial_entries').select('entry_type,amount,status,competence_date').limit(2000),
    neon.from('associates').select('status,state').limit(2000),
    neon.from('member_demands').select('status,priority').limit(2000),
    neon.from('protocols').select('status').limit(2000)
  ]);
  const metrics=[
    ['Associados',assoc.error?'—':assoc.data.length],
    ['Receitas pagas',fin.error?'—':fin.data.filter(x=>x.entry_type==='income'&&x.status==='paid').reduce((a,x)=>a+Number(x.amount||0),0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})],
    ['Despesas pagas',fin.error?'—':fin.data.filter(x=>x.entry_type==='expense'&&x.status==='paid').reduce((a,x)=>a+Number(x.amount||0),0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})],
    ['Demandas abertas',demands.error?'—':demands.data.filter(x=>!['resolved','closed'].includes(x.status)).length],
    ['Protocolos em aberto',protocols.error?'—':protocols.data.filter(x=>!['answered','archived'].includes(x.status)).length]
  ];
  cards.replaceChildren();
  metrics.forEach(([label,value])=>{const card=document.createElement('article');card.className='stat-card';const strong=document.createElement('strong');strong.textContent=String(value);const span=document.createElement('span');span.textContent=label;card.append(strong,span);cards.appendChild(card);});
  const finance=panel.querySelector('.anit-report-finance');
  if(fin.error){finance.textContent='Relatório financeiro indisponível para este perfil: '+fin.error.message;}
  else{
    const grouped={};fin.data.forEach(x=>{const month=String(x.competence_date||'').slice(0,7);if(!month)return;grouped[month]??={income:0,expense:0};if(x.status==='paid')grouped[month][x.entry_type]+=Number(x.amount||0);});
    const table=document.createElement('table');const head=document.createElement('tr');['Competência','Receitas pagas','Despesas pagas','Saldo'].forEach(x=>{const th=document.createElement('th');th.textContent=x;head.appendChild(th);});const thead=document.createElement('thead');thead.appendChild(head);table.appendChild(thead);
    const body=document.createElement('tbody');Object.keys(grouped).sort().reverse().forEach(month=>{const g=grouped[month];const vals=[month,g.income,g.expense,g.income-g.expense];const tr=document.createElement('tr');vals.forEach((v,i)=>{const td=document.createElement('td');td.textContent=i===0?v:Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});tr.appendChild(td);});body.appendChild(tr);});table.appendChild(body);finance.replaceChildren(table);
  }
  const members=panel.querySelector('.anit-report-members');
  if(assoc.error){members.textContent='Relatório de associados indisponível: '+assoc.error.message;}
  else{const counts={};assoc.data.forEach(x=>counts[x.status]=(counts[x.status]||0)+1);members.textContent=Object.entries(counts).map(([k,v])=>k+': '+v).join(' • ')||'Sem registros';}
}

async function loadSettings() {
  if(!['administrator','president'].includes(currentProfile.role)) return;
  const canEditSettings=currentProfile.role==='administrator';
  const section=document.getElementById('configuracoes');
  if(!section || document.getElementById('anit-settings')) return;
  section.querySelectorAll('.panel,.module-grid').forEach(node=>node.remove());
  const panel=document.createElement('div');panel.id='anit-settings';panel.className='panel anit-data-panel';
  panel.innerHTML='<div class="panel-head"><h2>Configurações institucionais</h2></div>'+(canEditSettings?'<form class="field-grid anit-create-form"><div class="field"><label>Chave da configuração</label><input name="setting_key" required placeholder="ex.: institutional_email"></div><div class="field full"><label>Valor em JSON</label><textarea name="setting_value" rows="5" required placeholder="{&quot;value&quot;:&quot;...&quot;}"></textarea></div><button class="btn btn-primary" type="submit">Salvar configuração</button></form>':'<p class="muted">Acesso de consulta. Somente o Administrador pode alterar parâmetros técnicos.</p>')+'<p class="anit-feedback" role="status"></p><div class="anit-settings-table"></div>';
  section.appendChild(panel);
  const form=panel.querySelector('form');
  form?.addEventListener('submit',async event=>{
    event.preventDefault();const feedback=panel.querySelector('.anit-feedback');const raw=Object.fromEntries(new FormData(form).entries());
    let value;try{value=JSON.parse(raw.setting_value);}catch{feedback.textContent='O valor precisa ser um JSON válido.';feedback.dataset.kind='error';return;}
    const {error}=await neon.from('system_settings').upsert({setting_key:raw.setting_key.trim(),setting_value:value,updated_by:currentUser.id},{onConflict:'setting_key'});
    if(error){feedback.textContent='Não foi possível salvar: '+error.message;feedback.dataset.kind='error';return;}
    feedback.textContent='Configuração salva.';feedback.dataset.kind='success';form.reset();await renderSettings(panel);
  });
  await renderSettings(panel);
}
async function renderSettings(panel){
  const form=panel.querySelector('form');
  const wrap=panel.querySelector('.anit-settings-table');
  const {data,error}=await neon.from('system_settings').select('setting_key,setting_value,updated_at,updated_by').order('setting_key');
  if(error){wrap.textContent='Não foi possível consultar configurações: '+error.message;return;}
  const table=document.createElement('table');const thead=document.createElement('thead');const hr=document.createElement('tr');
  ['Chave','Valor','Atualizada em','Ação'].forEach(x=>{const th=document.createElement('th');th.textContent=x;hr.appendChild(th);});thead.appendChild(hr);table.appendChild(thead);
  const body=document.createElement('tbody');
  (data||[]).forEach(item=>{const tr=document.createElement('tr');[item.setting_key,JSON.stringify(item.setting_value),new Date(item.updated_at).toLocaleString('pt-BR')].forEach(value=>{const td=document.createElement('td');td.textContent=value;tr.appendChild(td);});
    const action=document.createElement('td');
    if(form){
      const edit=document.createElement('button');edit.type='button';edit.className='btn btn-light btn-small';edit.textContent='Carregar';
      edit.addEventListener('click',()=>{form.elements.setting_key.value=item.setting_key;form.elements.setting_value.value=JSON.stringify(item.setting_value,null,2);form.scrollIntoView({behavior:'smooth',block:'center'});});
      const del=document.createElement('button');del.type='button';del.className='btn btn-danger btn-small';del.textContent='Excluir';
      del.addEventListener('click',async()=>{if(!confirm('Excluir esta configuração?'))return;const {error}=await neon.from('system_settings').delete().eq('setting_key',item.setting_key);if(error){alert(error.message);return;}await renderSettings(panel);});
      action.append(edit,del);
    }else{action.textContent='Consulta';}
    tr.appendChild(action);body.appendChild(tr);
  });
  table.appendChild(body);const frame=document.createElement('div');frame.className='table-wrap';frame.appendChild(table);wrap.replaceChildren(frame);
}
async function boot() {
  if (!AUTH_URL || !DATA_API_URL) {
    showMessage('A configuração pública da autenticação e da API ainda não foi adicionada ao ambiente de hospedagem.');
    return;
  }
  neon = createClient({ auth: { url: AUTH_URL }, dataApi: { url: DATA_API_URL, options: { db: { schema: 'anit' } } } });
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
  await loadReports();
  await loadSettings();
}

form?.addEventListener('submit', async event => {
  event.preventDefault();
  clearMessage();
  if (!neon) {
    if (!AUTH_URL || !DATA_API_URL) {
      showMessage('O ambiente ainda não está configurado para autenticação.');
      return;
    }
    neon = createClient({ auth: { url: AUTH_URL }, dataApi: { url: DATA_API_URL, options: { db: { schema: 'anit' } } } });
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
  if (!neon && AUTH_URL && DATA_API_URL) neon = createClient({ auth: { url: AUTH_URL }, dataApi: { url: DATA_API_URL, options: { db: { schema: 'anit' } } } });
  const email = document.getElementById('loginEmail').value.trim();
  if (!email) {
    showMessage('Informe seu e-mail no campo acima para receber um código de recuperação.');
    return;
  }
  const { error } = await neon.auth.forgetPassword.emailOtp({ email });
  if (error) {
    showMessage('Não foi possível enviar o código. Confirme se o e-mail já foi verificado e tente novamente. Detalhe: ' + error.message);
    return;
  }
  const target = new URL('./auth.html', window.location.href);
  target.searchParams.set('path', 'reset-password-otp');
  target.searchParams.set('email', email);
  window.location.assign(target.toString());
});

document.addEventListener('DOMContentLoaded', () => {
  const styles = document.createElement('style');
  styles.textContent = `
    .anit-data-panel{margin-top:18px}.anit-create-form{margin:8px 0 18px;padding:16px;border:1px solid var(--line);border-radius:12px;background:#f9fbfd}.anit-create-form .field{min-width:0}.anit-create-form button{justify-self:start}.anit-feedback{font-size:.82rem;color:var(--muted)}.anit-feedback[data-kind="error"]{color:#a83c3c}.anit-feedback[data-kind="success"]{color:#26734d}.anit-table-wrap{overflow:auto}.anit-table-wrap table{min-width:720px}.anit-toolbar{display:flex;gap:8px;align-items:center}.anit-search{max-width:240px;padding:9px;border:1px solid var(--line);border-radius:8px}.btn-small{padding:6px 9px;margin:2px}.btn-danger{background:#a83232;color:#fff;border:0;border-radius:7px;padding:7px 10px}.anit-report-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:16px 0}.anit-report-cards .stat-card{padding:14px;border:1px solid var(--line);border-radius:10px}.anit-report-cards strong{display:block;font-size:1.25rem}.anit-report-cards span{color:var(--muted);font-size:.85rem}
    #signOutButton{margin-left:12px}.nav button[hidden],[data-go][hidden]{display:none!important}
  `;
  document.head.appendChild(styles);
  boot().catch(err => showMessage(err.message || 'Falha ao iniciar a Central Administrativa.'));
});