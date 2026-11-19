import { createClient } from '@neondatabase/neon-js';
import { NEON_AUTH_URL, NEON_DATA_API_URL } from './config.js';

// Remove credenciais eventualmente recebidas por URL antes de inicializar a aplicação.
if (window.location.search) {
  const safeUrl = new URL(window.location.href);
  const hadCredentials = safeUrl.searchParams.has('password') || safeUrl.searchParams.has('email');
  safeUrl.searchParams.delete('password');
  safeUrl.searchParams.delete('email');
  if (hadCredentials) window.history.replaceState({}, document.title, safeUrl.pathname + safeUrl.search + safeUrl.hash);
}

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

const ENUM_LABELS = {
  pending: 'Pendente', active: 'Ativo', suspended: 'Suspenso',
  resigned: 'Desligado a pedido', excluded: 'Excluído',
  ended: 'Encerrado', revoked: 'Revogado',
  income: 'Receita', expense: 'Despesa', paid: 'Pago',
  cancelled: 'Cancelado', overdue: 'Em atraso',
  incoming: 'Recebido', outgoing: 'Enviado', internal: 'Interno',
  open: 'Aberto', in_analysis: 'Em análise', awaiting_documents: 'Aguardando documentos', awaiting_response: 'Aguardando resposta', in_progress: 'Em andamento', decision_issued: 'Decisão proferida', appeal: 'Em recurso', answered: 'Respondido',
  archived: 'Arquivado', public: 'Público', restricted: 'Restrito',
  confidential: 'Confidencial', monitoring: 'Em acompanhamento',
  closed: 'Concluído', paused: 'Pausado', scheduled: 'Agendado',
  decision_issued: 'Decisão proferida', appeal: 'Em recurso',
  held: 'Realizado', draft: 'Rascunho', published: 'Publicado',
  low: 'Baixa', normal: 'Normal', high: 'Alta', urgent: 'Urgente',
  waiting: 'Aguardando', resolved: 'Resolvido',
  in_analysis: 'Em análise', awaiting_documents: 'Aguardando documentos', awaiting_response: 'Aguardando resposta',
  repealed: 'Revogada integralmente',
  vigente: 'Vigente', 'em revisão': 'Em revisão', substituído: 'Substituído',
  vencido: 'Vencido', arquivado: 'Arquivado',
  administrativa: 'Administrativa', judicial: 'Judicial', extrajudicial: 'Extrajudicial', regulatoria: 'Regulatória', consulta: 'Consulta', representacao: 'Representação',
  in_contact: 'Em contato', awaiting_response: 'Aguardando resposta', meeting_scheduled: 'Reunião agendada', in_negotiation: 'Em negociação',
  orgao_publico: 'Órgão público', autarquia: 'Autarquia', entidade_classe: 'Entidade de classe', sindicato: 'Sindicato', universidade: 'Universidade', empresa: 'Empresa', organizacao_social: 'Organização social', outro: 'Outro',
  oficio: 'Ofício', parceria: 'Parceria', reuniao: 'Reunião', negociacao: 'Negociação', consulta: 'Consulta', cooperacao: 'Cooperação', acompanhamento: 'Acompanhamento',
  email: 'E-mail', telefone: 'Telefone', reuniao_presencial: 'Reunião presencial', reuniao_online: 'Reunião on-line', whatsapp: 'WhatsApp',
  federal: 'Federal', estadual: 'Estadual', municipal: 'Municipal',
  institucional: 'Institucional'
};

const COLUMN_LABELS = {
  membership_number: 'Matrícula', full_name: 'Nome completo', email: 'E-mail',
  phone: 'Telefone', city: 'Cidade', state: 'UF', category: 'Categoria',
  status: 'Situação', case_type: 'Tipo de demanda', opposing_party: 'Parte relacionada', office: 'Cargo', term_start: 'Início do mandato',
  term_end: 'Fim do mandato', entry_type: 'Tipo', description: 'Descrição',
  amount: 'Valor', competence_date: 'Competência', due_date: 'Vencimento',
  payment_method: 'Forma de pagamento', protocol_number: 'Número do protocolo',
  direction: 'Fluxo', subject: 'Assunto', sender: 'Remetente',
  recipient: 'Destinatário', received_at: 'Data de recebimento',
  title: 'Título', document_type: 'Tipo documental',
  document_number: 'Número do documento', version: 'Versão',
  issued_at: 'Data de emissão', expires_at: 'Validade',
  confidentiality: 'Classificação', category: 'Categoria documental',
  issuing_body: 'Órgão emissor / responsável', document_status: 'Situação documental',
  storage_path: 'Arquivo / link seguro', case_number: 'Número do processo',
  institution: 'Órgão/Instituição', deadline: 'Prazo',
  contact_name: 'Nome do contato', next_action_at: 'Próxima ação', relation_type: 'Natureza da relação', institution_type: 'Tipo de instituição', channel: 'Canal de contato', last_contact_at: 'Último contato',
  meeting_type: 'Tipo de reunião', starts_at: 'Início', ends_at: 'Término',
  location: 'Local', channel: 'Canal', audience: 'Público',
  scheduled_at: 'Agendamento', priority: 'Prioridade',
  responsible_user_id: 'Responsável',
  norm_type: 'Tipo de norma', issuing_body: 'Órgão emissor',
  reference_number: 'Número / identificação', jurisdiction: 'Abrangência',
  published_on: 'Publicação', effective_on: 'Início da vigência',
  source_url: 'Fonte oficial', summary: 'Ementa / observações'
};

function translateEnum(value) {
  if (value == null) return '—';
  return ENUM_LABELS[String(value)] || String(value).replaceAll('_', ' ');
}

function formatColumnLabel(column) {
  return COLUMN_LABELS[column] || column.replaceAll('_', ' ');
}

const MODULES = [
  { section: 'associados', table: 'associates', title: 'Associados', columns: ['membership_number','full_name','email','phone','city','state','category','status'], fields: [
    ['membership_number','Matrícula','text'],['category','Tipo de associado','select',true,['Associado Light','Associado Hard','Doador','Benemérito','Honorário','Institucional']],['joined_at','Data de filiação','date'],['status','Situação','select',true,['pending','active','suspended','resigned','excluded']],['notes','Observações administrativas','textarea']
  ]},
  { section: 'diretoria', table: 'board_members', title: 'Diretoria e mandatos', columns: ['full_name','office','term_start','term_end','status'], fields: [
    ['full_name','Nome completo','text',true],['office','Cargo','text',true],['term_start','Início do mandato','date',true],['term_end','Fim do mandato','date'],['status','Situação','select',false,['active','ended','revoked']]
  ]},
  { section: 'financeiro', table: 'financial_entries', title: 'Movimentações financeiras', columns: ['entry_type','description','amount','competence_date','category','status'], fields: [
    ['entry_type','Tipo','select',true,['income','expense']],['description','Descrição','text',true],['amount','Valor (R$)','number',true],['competence_date','Competência','date',true],['due_date','Vencimento','date'],['category','Categoria','text'],['payment_method','Forma de pagamento','text'],['status','Situação','select',false,['pending','paid','cancelled','overdue']]
  ]},
  { section: 'secretaria', table: 'protocols', title: 'Protocolos', columns: ['protocol_number','direction','subject','sender','recipient','received_at','due_date','status'], fields: [
    ['received_at','Data de recebimento','datetime-local',true],['protocol_number','Número do protocolo','text',true],['direction','Fluxo','select',true,['incoming','outgoing','internal']],['subject','Assunto','text',true],['sender','Remetente','text'],['recipient','Destinatário','text'],['due_date','Prazo','date'],['status','Situação','select',false,['open','in_progress','answered','archived']],['notes','Observações','textarea']
  ]},
  { section: 'documentos', table: 'official_documents', title: 'Arquivo digital institucional', columns: ['title','category','document_type','document_number','issuing_body','version','issued_at','expires_at','document_status','confidentiality'], fields: [
    ['title','Título do documento','text',true],
    ['category','Categoria documental','select',true,['Estatuto e regimentos','Atas e deliberações','Ofícios expedidos','Ofícios recebidos','Resoluções','Portarias','Notas técnicas','Pareceres','Contratos e convênios','Procurações','Certidões e registros','Editais e convocações','Relatórios institucionais','Comunicados e circulares','Documentos financeiros','Documentos cadastrais','Outros']],
    ['document_type','Tipo / espécie documental','text',true],
    ['document_number','Número / identificação','text'],
    ['issuing_body','Órgão emissor / responsável','text'],
    ['issued_at','Data de emissão','date'],
    ['expires_at','Validade / vencimento','date'],
    ['version','Versão','number',true],
    ['document_status','Situação documental','select',true,['vigente','em revisão','substituído','vencido','arquivado']],
    ['confidentiality','Classificação de acesso','select',true,['internal','public','restricted','confidential']],
    ['description','Ementa / descrição','textarea']
  ]},
  { section: 'juridico', table: 'legal_cases', title: 'Demandas e processos jurídicos', columns: ['title','case_type','case_number','institution','priority','status','deadline'], fields: [
    ['title','Título / assunto','text',true],
    ['case_type','Tipo de demanda','select',true,['administrativa','judicial','extrajudicial','regulatoria','consulta','representacao']],
    ['case_number','Número do processo / protocolo','text'],
    ['institution','Órgão / instituição responsável','text'],
    ['opposing_party','Parte relacionada / interessado','text'],
    ['priority','Prioridade','select',true,['low','normal','high','urgent']],
    ['deadline','Prazo / próxima data limite','date'],
    ['status','Situação atual','select',true,['open','in_analysis','awaiting_documents','awaiting_response','in_progress','decision_issued','appeal','suspended','closed','archived']],
    ['summary','Resumo / histórico inicial','textarea']
  ]},
  { section: 'juridico', table: 'legal_references', title: 'Legislação e normas', columns: ['title','norm_type','issuing_body','reference_number','jurisdiction','published_on','effective_on','status'], fields: [
    ['title','Título da norma','text',true],['norm_type','Tipo de norma','select',true,['Lei','Decreto','Resolução','Portaria','Deliberação','Instrução normativa','Medida provisória','Outro']],['issuing_body','Órgão emissor','text'],['reference_number','Número / identificação','text'],['jurisdiction','Abrangência','select',true,['federal','estadual','municipal','institucional']],['published_on','Data de publicação','date'],['effective_on','Início da vigência','date'],['status','Situação','select',true,['draft','active','revoked','repealed']],['source_url','Link da fonte oficial','url'],['summary','Ementa / observações','textarea']
  ]},
  { section: 'representacao', table: 'institutional_relations', title: 'Relações institucionais', columns: ['institution','institution_type','relation_type','contact_name','subject','priority','status','next_action_at'], fields: [
    ['institution','Instituição / entidade','text',true],
    ['institution_type','Tipo de instituição','select',true,['orgao_publico','autarquia','entidade_classe','sindicato','universidade','empresa','organizacao_social','outro']],
    ['relation_type','Natureza da relação','select',true,['representacao','oficio','parceria','reuniao','negociacao','consulta','cooperacao','acompanhamento']],
    ['contact_name','Pessoa de contato','text'],['subject','Assunto / pauta principal','text'],
    ['channel','Canal de contato','select',false,['email','telefone','oficio','reuniao_presencial','reuniao_online','whatsapp','outro']],
    ['last_contact_at','Último contato','datetime-local'],['next_action_at','Próxima ação / compromisso','datetime-local'],
    ['priority','Prioridade','select',true,['low','normal','high','urgent']],
    ['status','Situação atual','select',true,['active','in_contact','awaiting_response','meeting_scheduled','in_negotiation','paused','completed','closed']],
    ['notes','Histórico / observações','textarea']
  ]},
  { section: 'reunioes', table: 'meetings', title: 'Agenda e reuniões', columns: ['meeting_number','title','meeting_type','starts_at','location','status'], fields: [
    ['title','Título da reunião','text',true],['meeting_type','Tipo de reunião','select',true,['assembleia_geral','diretoria','conselho_fiscal','comissao','extraordinaria','institucional','outra']],['starts_at','Início','datetime-local',true],['ends_at','Término','datetime-local'],['meeting_mode','Modalidade','select',true,['presencial','online','hibrida']],['location','Local / endereço','text'],['meeting_link','Link da reunião','url'],['organizer','Responsável pela convocação','text'],['participants_summary','Participantes / convidados','textarea'],['agenda','Pauta e ordem do dia','textarea',true],['report_body','Relato e resumo da reunião','textarea'],['decisions','Deliberações e decisões','textarea'],['status','Situação','select',true,['scheduled','held','cancelled']]
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

async function addDataPanel(module) {
  const section = document.getElementById(module.section);
  if (!section || document.getElementById('data-' + module.table)) return;
  section.querySelectorAll('.empty,.module-grid').forEach(node => node.remove());
  const panel = document.createElement('div');
  panel.className = 'panel anit-data-panel';
  panel.id = 'data-' + module.table;
  panel.innerHTML = '<div class="panel-head"><h2></h2><div class="anit-toolbar"><input class="anit-search" type="search" placeholder="Buscar registros"><button class="btn btn-light anit-refresh" type="button">Atualizar</button></div></div><div class="anit-form-wrap"></div><div class="anit-table-wrap"></div><p class="anit-feedback" role="status"></p>';
  panel.querySelector('h2').textContent = module.title;
  section.appendChild(panel);
  if (module.table === 'legal_cases') {
    const legalArea=document.createElement('div'); legalArea.className='anit-legal-details panel'; legalArea.hidden=true; panel.appendChild(legalArea);
  }
  if (module.table === 'institutional_relations') {
    const relationArea=document.createElement('div'); relationArea.className='anit-legal-details panel'; relationArea.hidden=true; panel.appendChild(relationArea);
  }
  if (module.table === 'official_documents') {
    const attachmentArea = document.createElement('div');
    attachmentArea.className = 'anit-attachments panel';
    attachmentArea.hidden = true;
    panel.appendChild(attachmentArea);
  }
  if(module.table==='meetings'){const calendar=document.createElement('div');calendar.className='anit-meeting-calendar';panel.insertBefore(calendar,panel.querySelector('.anit-form-wrap'));const workspace=document.createElement('div');workspace.className='anit-meeting-workspace panel';workspace.hidden=true;panel.append(workspace);}
  const formWrap = panel.querySelector('.anit-form-wrap');
  const createForm = document.createElement('form');
  createForm.className = 'field-grid anit-create-form';
  createForm.dataset.mode = 'create';
  const allowedToManage = canManage(module.table, currentProfile.role);
  let editingId = null;
  let editingOriginalStatus = null;
  if (module.table === 'associates' && currentProfile.role === 'administrator') {
    const typesButton = document.createElement('button');
    typesButton.type = 'button';
    typesButton.className = 'btn btn-light btn-small';
    typesButton.textContent = 'Gerenciar tipos de associados';
    panel.querySelector('.anit-toolbar').appendChild(typesButton);
    typesButton.addEventListener('click', async () => {
      const { data, error } = await neon.from('system_settings').select('setting_value').eq('setting_key','associate_types').maybeSingle();
      if (error) {
        showMessage('Não foi possível consultar os tipos de associados.');
        return;
      }
      const defaults = ['Associado Light','Associado Hard','Doador','Benemérito','Honorário','Institucional'];
      const current = Array.isArray(data?.setting_value) ? data.setting_value : defaults;
      const answer = window.prompt('Informe os tipos de associados separados por vírgula. Esses tipos serão oferecidos na edição dos cadastros recebidos:', current.join(', '));
      if (answer === null) return;
      const types = [...new Set(answer.split(',').map(value => value.trim()).filter(Boolean))];
      if (!types.length) {
        showMessage('Mantenha pelo menos um tipo de associado cadastrado.');
        return;
      }
      const { error: saveError } = await neon.from('system_settings').upsert({
        setting_key: 'associate_types',
        setting_value: types,
        updated_by: currentUser.id
      }, { onConflict: 'setting_key' });
      if (saveError) {
        showMessage('Não foi possível salvar os tipos de associados.');
        return;
      }
      const category = createForm.elements.namedItem('category');
      if (category) {
        const previous = category.value;
        category.replaceChildren(...types.map(type => {
          const option = document.createElement('option');
          option.value = type;
          option.textContent = type;
          return option;
        }));
        if (previous && !types.includes(previous)) {
          const option = document.createElement('option');
          option.value = previous;
          option.textContent = previous;
          category.appendChild(option);
        }
        category.value = previous && [...category.options].some(option => option.value === previous) ? previous : types[0];
      }
      showMessage('Tipos de associados atualizados.', 'success');
    });
  }
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
    editingOriginalStatus = null;
    createForm.reset();
    createForm.dataset.mode = 'create';
    submit.textContent = 'Salvar registro';
    cancel.hidden = true;
    if (['associates','protocols'].includes(module.table)) createForm.hidden = true;
    panel.querySelector('.anit-feedback').textContent = '';
  });
  let attachmentInput = null;
  if (['official_documents','legal_cases','institutional_relations','meetings'].includes(module.table)) {
    const attachmentField = document.createElement('div');
    attachmentField.className = 'field';
    attachmentField.style.gridColumn = '1 / -1';
    const attachmentLabel = document.createElement('label');
    attachmentLabel.textContent = 'Anexos (PDF, DOCX, XLSX, JPG ou PNG — até 5 MB cada)';
    attachmentInput = document.createElement('input');
    attachmentInput.type = 'file';
    attachmentInput.name = '_attachments';
    attachmentInput.multiple = true;
    attachmentInput.accept = '.pdf,.docx,.xlsx,.jpg,.jpeg,.png,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/jpeg,image/png';
    attachmentLabel.htmlFor = module.table + '-attachments';
    attachmentInput.id = module.table + '-attachments';
    attachmentField.append(attachmentLabel, attachmentInput);
    createForm.appendChild(attachmentField);
    const hint = document.createElement('small');
    hint.className = 'muted';
    hint.textContent = 'Os arquivos serão armazenados no banco ANIT-ADMIN, com acesso protegido pelas permissões institucionais.';
    attachmentField.appendChild(hint);
  }
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
        option.textContent = translateEnum(value);
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
    if (module.table === 'official_documents' && name === 'version') input.value = '1';
    if (['legal_cases','institutional_relations'].includes(module.table) && name === 'priority') input.value = 'normal';
    if (module.table === 'protocols' && name === 'protocol_number') {
      input.readOnly = true;
      input.placeholder = 'Gerado automaticamente ao iniciar novo protocolo';
    }
    if (required) input.required = true;
    field.appendChild(input);
    createForm.appendChild(field);
  });

  if (module.table === 'associates') {
    const privacyNotice = document.createElement('p');
    privacyNotice.className = 'muted';
    privacyNotice.textContent = 'Dados pessoais (nome, e-mail, telefone, cidade, UF e registro profissional) são somente para consulta nesta área. A administração não pode alterá-los. A correção deverá ser solicitada pelo próprio associado após validação de identidade.';
    privacyNotice.style.gridColumn = '1 / -1';
    formWrap.appendChild(privacyNotice);
    const category = createForm.elements.namedItem('category');
    const { data: typeSetting } = await neon.from('system_settings').select('setting_value').eq('setting_key','associate_types').maybeSingle();
    const configuredTypes = Array.isArray(typeSetting?.setting_value) ? typeSetting.setting_value : null;
    if (category && configuredTypes?.length) {
      category.replaceChildren(...configuredTypes.map(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        return option;
      }));
    }
  }

  if (allowedToManage) {
    createForm.append(submit, cancel);
    if (module.table === 'associates') createForm.hidden = true;
    createForm.addEventListener('submit', async event => {
      event.preventDefault();
      const feedback = panel.querySelector('.anit-feedback');
      if (module.table === 'associates' && !editingId) {
        feedback.textContent = 'Novas filiações devem ser solicitadas exclusivamente pela página pública da ANIT.';
        feedback.dataset.kind = 'error';
        return;
      }
      const attachmentFiles = ['official_documents','legal_cases','institutional_relations','meetings'].includes(module.table)
        ? [...(attachmentInput?.files || [])].filter(file => file && file.size > 0)
        : [];
      const payload = Object.fromEntries(new FormData(createForm).entries());
      delete payload._attachments;
      Object.keys(payload).forEach(key => {
        if (payload[key] === '') delete payload[key];
        if (['amount','version'].includes(key) && payload[key] !== undefined) payload[key] = Number(payload[key]);
        if (['starts_at','ends_at','scheduled_at','received_at','next_action_at','last_contact_at'].includes(key) && payload[key]) payload[key] = new Date(payload[key]).toISOString();
      });
      try {
        submit.disabled = true;
        const sessionResult = await neon.auth.getSession();
        const activeSessionUser = sessionResult?.data?.user;
        if (sessionResult?.error || !sessionResult?.data?.session || !activeSessionUser?.id || activeSessionUser.id !== currentUser.id) {
          throw new Error('Sua sessão não está sincronizada com o banco. Saia da Central ANIT, entre novamente e tente salvar.');
        }
        if (module.table === 'board_members') {
          const { data: accessCheck, error: accessError } = await neon.rpc('current_board_access_check');
          const access = Array.isArray(accessCheck) ? accessCheck[0] : accessCheck;
          if (accessError) {
            throw new Error('Não foi possível verificar sua autorização no banco. Detalhe: ' + accessError.message);
          }
          if (!access?.authenticated_user_id) {
            throw new Error('O banco recebeu a operação sem identificar seu usuário autenticado (JWT). Saia da Central, entre novamente e tente. Se persistir, precisamos corrigir a integração de autenticação com a API de dados.');
          }
          if (!access.has_board_management_role) {
            throw new Error('O banco identificou seu usuário, mas não reconheceu o perfil Administrador ou Presidente. Solicite a revisão do vínculo entre sua conta e o perfil institucional.');
          }
        }
        let savedDocumentId = editingId;
        if (editingId) {
          if(module.table==='meetings'){const b=document.createElement('button');b.type='button';b.className='btn btn-light btn-small';b.textContent='Relatório e acompanhamento';b.addEventListener('click',()=>showMeetingDetails(row));actions.append(b);}
      if (module.table === 'institutional_relations') {
          const nextStatus=payload.status || 'active';
          if(!editingId) {
            const {error:historyError}=await neon.from('institutional_relation_updates').insert({
              relation_id:savedDocumentId,event_date:new Date().toISOString().slice(0,10),
              previous_status:null,new_status:nextStatus,
              notes:payload.notes || 'Cadastro inicial do relacionamento institucional.',
              created_by:activeSessionUser.id
            });
            if(historyError)throw historyError;
          }
          if(attachmentFiles.length) {
            try {
              await uploadInstitutionalAttachments(savedDocumentId,attachmentFiles);
              feedback.textContent='Relação institucional salva e anexo(s) armazenado(s).';
            } catch(attachmentError) {
              feedback.textContent='A relação foi salva, mas houve falha ao armazenar os anexos: '+attachmentError.message+'. Use Acompanhamento para tentar novamente.';
              feedback.dataset.kind='error'; await loadTable(module); return;
            }
          }
        }
        if (module.table === 'legal_cases') {
            const { status: nextStatus, ...caseFields } = payload;
            const { error } = await neon.from(module.table).update(caseFields).eq('id', editingId);
            if (error) throw error;
            if (nextStatus && editingOriginalStatus !== nextStatus) {
              const { error: statusError } = await neon.rpc('update_legal_case_status', {
                p_case_id: editingId, p_new_status: nextStatus,
                p_event_date: new Date().toISOString().slice(0,10),
                p_notes: 'Situação alterada no formulário de edição.'
              });
              if (statusError) throw statusError;
            }
          } else if (module.table === 'institutional_relations') {
            const { status: nextStatus, ...relationFields } = payload;
            const { error } = await neon.from(module.table).update(relationFields).eq('id', editingId);
            if (error) throw error;
            if (nextStatus && editingOriginalStatus !== nextStatus) {
              const { error: statusError } = await neon.rpc('update_institutional_relation_status', {
                p_relation_id: editingId, p_new_status: nextStatus,
                p_event_date: new Date().toISOString().slice(0,10),
                p_notes: 'Situação alterada no formulário de edição.'
              });
              if (statusError) throw statusError;
            }
          } else {
            const { error } = await neon.from(module.table).update(payload).eq('id', editingId);
            if (error) throw error;
          }
          feedback.textContent = 'Registro atualizado com sucesso.';
        } else {
          payload.created_by = activeSessionUser.id;
          if (['official_documents','legal_cases','institutional_relations','meetings'].includes(module.table)) {
            const { data: inserted, error } = await neon.from(module.table).insert(payload).select('id').single();
            if (error) throw error;
            savedDocumentId = inserted.id;
          } else {
            const { error } = await neon.from(module.table).insert(payload);
            if (error) {
              if (module.table === 'board_members' && /row-level security|policy/i.test(error.message || '')) {
                throw new Error('O banco não reconheceu sua autorização para gerenciar a diretoria. Confirme que seu perfil está ativo como Administrador ou Presidente e entre novamente na Central.');
              }
              throw error;
            }
          }
          feedback.textContent = 'Registro cadastrado com sucesso.';
        }
        if (module.table === 'legal_cases') {
          const nextStatus = payload.status || 'open';
          if (!editingId) {
            const { error: historyError } = await neon.from('legal_case_updates').insert({
              case_id: savedDocumentId, event_date: new Date().toISOString().slice(0,10),
              previous_status: null, new_status: nextStatus,
              notes: payload.summary || 'Cadastro inicial da demanda jurídica.', created_by: activeSessionUser.id
            });
            if (historyError) throw historyError;
          }
          if (attachmentFiles.length) {
            try {
              await uploadLegalCaseAttachments(savedDocumentId, attachmentFiles, activeSessionUser.id);
              feedback.textContent = 'Demanda salva e anexo(s) armazenado(s) com sucesso.';
            } catch (attachmentError) {
              feedback.textContent = 'A demanda foi salva, mas houve falha ao armazenar os anexos: ' + attachmentError.message + '. Use Acompanhamento para tentar novamente.';
              feedback.dataset.kind = 'error';
              await loadTable(module);
              return;
            }
          }
        }
        if (module.table === 'meetings' && attachmentFiles.length) {
          try { await uploadMeetingAttachments(savedDocumentId, attachmentFiles); feedback.textContent = 'Reunião salva e anexos armazenados.'; }
          catch (e) { feedback.textContent = 'Reunião salva, mas houve falha nos anexos: ' + e.message; feedback.dataset.kind = 'error'; await loadTable(module); return; }
        }
        if (module.table === 'official_documents' && attachmentFiles.length) {
          try {
            await uploadOfficialDocumentAttachments(savedDocumentId, attachmentFiles, activeSessionUser.id);
            feedback.textContent = 'Documento salvo e anexo(s) armazenado(s) com sucesso.';
          } catch (attachmentError) {
            feedback.textContent = 'O documento foi salvo, mas houve falha ao armazenar os anexos: ' + attachmentError.message + '. Use a opção Anexos no registro para tentar novamente.';
            feedback.dataset.kind = 'error';
            await loadTable(module);
            return;
          }
        }
        feedback.dataset.kind = 'success';
        editingId = null;
        editingOriginalStatus = null;
        createForm.reset();
        createForm.dataset.mode = 'create';
        submit.textContent = 'Salvar registro';
        cancel.hidden = true;
        if (['associates','protocols'].includes(module.table)) createForm.hidden = true;
        if (module.table === 'protocols') {
          const newButton = document.getElementById('newProtocolButton');
          if (newButton) newButton.textContent = 'Novo protocolo';
        }
        await loadTable(module);
      } catch (error) {
        feedback.textContent = 'Não foi possível salvar: ' + (error.message || 'erro desconhecido');
        feedback.dataset.kind = 'error';
      } finally {
        submit.disabled = false;
      }
    });
    if (['associates','protocols'].includes(module.table)) createForm.hidden = true;
    formWrap.appendChild(createForm);
    if (module.table === 'protocols') {
      const newButton = document.getElementById('newProtocolButton');
      if (newButton) newButton.addEventListener('click', async () => {
        editingId = null;
        createForm.reset();
        createForm.hidden = false;
        createForm.dataset.mode = 'create';
        submit.textContent = 'Registrar protocolo';
        cancel.hidden = false;
        const received = createForm.elements.namedItem('received_at');
        if (received) {
          const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
          received.value = now.toISOString().slice(0,16);
        }
        const feedback = panel.querySelector('.anit-feedback');
        feedback.textContent = 'Gerando número do protocolo...';
        feedback.dataset.kind = 'info';
        newButton.disabled = true;
        try {
          const { data, error } = await neon.rpc('next_protocol_number');
          if (error) throw error;
          const number = Array.isArray(data) ? data[0] : data;
          const generated = typeof number === 'string' ? number : number?.next_protocol_number;
          if (!generated) throw new Error('O banco não retornou o número do protocolo.');
          createForm.elements.namedItem('protocol_number').value = generated;
          feedback.textContent = 'Número gerado. Preencha os dados e registre o protocolo.';
          feedback.dataset.kind = 'success';
        } catch (error) {
          feedback.textContent = 'Não foi possível gerar o número: ' + (error.message || 'erro desconhecido');
          feedback.dataset.kind = 'error';
        } finally {
          newButton.disabled = false;
        }
        createForm.scrollIntoView({behavior:'smooth',block:'center'});
      });
    }
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
    editingOriginalStatus = row.status ?? null;
    createForm.hidden = false;
    if (module.table === 'protocols') {
      const newButton = document.getElementById('newProtocolButton');
      if (newButton) newButton.textContent = 'Novo protocolo';
    }
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

const OFFICIAL_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
const OFFICIAL_ATTACHMENT_TYPES = new Map([
  ['pdf','application/pdf'],
  ['docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ['xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ['jpg','image/jpeg'], ['jpeg','image/jpeg'], ['png','image/png']
]);

async function uploadOfficialDocumentAttachments(documentId, files, userId) {
  if (!documentId) throw new Error('Documento não identificado para anexar arquivos.');
  if (files.length > 10) throw new Error('Envie no máximo 10 anexos por operação.');
  for (const file of files) {
    const extension = (file.name.split('.').pop() || '').toLowerCase();
    const expectedType = OFFICIAL_ATTACHMENT_TYPES.get(extension);
    if (!expectedType) throw new Error('Formato não permitido: ' + file.name);
    if (file.size > OFFICIAL_ATTACHMENT_MAX_BYTES) throw new Error('O arquivo ' + file.name + ' ultrapassa o limite de 5 MB.');
    const buffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    const checksum = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2,'0')).join('');
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    const base64 = btoa(binary);
    const safeName = Array.from(file.name).map(char => char === '/' || char === String.fromCharCode(92) || char.charCodeAt(0) < 32 ? '_' : char).join('').slice(0,240);
    const { error } = await neon.rpc('store_official_document_attachment', {
      p_document_id: documentId,
      p_file_name: safeName,
      p_content_type: expectedType,
      p_file_base64: base64,
      p_checksum_sha256: checksum
    });
    if (error) throw new Error('Falha ao armazenar ' + safeName + ': ' + error.message);
  }
}

async function showOfficialDocumentAttachments(docRecord) {
  const panel = window.document.getElementById('data-official_documents');
  const feedback = panel?.querySelector('.anit-feedback');
  if (!panel || !feedback) return;
  feedback.textContent = 'Consultando anexos...';
  feedback.dataset.kind = 'info';
  const { data, error } = await neon.from('official_document_attachments')
    .select('id,file_name,content_type,file_size,created_at,uploaded_by')
    .eq('document_id', docRecord.id).order('created_at',{ascending:false});
  if (error) {
    feedback.textContent = 'Não foi possível consultar anexos: ' + error.message;
    feedback.dataset.kind = 'error';
    return;
  }
  const area = panel.querySelector('.anit-attachments');
  area.replaceChildren();
  const heading = document.createElement('h3');
  heading.textContent = 'Anexos — ' + docRecord.title;
  area.appendChild(heading);
  if (canManage('official_documents', currentProfile.role)) {
    const uploadLabel = window.document.createElement('label');
    uploadLabel.className = 'btn btn-primary btn-small';
    uploadLabel.textContent = 'Adicionar anexos';
    const uploadInput = window.document.createElement('input');
    uploadInput.type = 'file';
    uploadInput.multiple = true;
    uploadInput.accept = '.pdf,.docx,.xlsx,.jpg,.jpeg,.png';
    uploadInput.hidden = true;
    uploadInput.addEventListener('change', async () => {
      const files = [...uploadInput.files].filter(file => file.size > 0);
      if (!files.length) return;
      uploadLabel.textContent = 'Enviando...';
      uploadLabel.style.pointerEvents = 'none';
      try {
        await uploadOfficialDocumentAttachments(docRecord.id, files, currentUser.id);
        await showOfficialDocumentAttachments(docRecord);
      } catch (error) {
        feedback.textContent = 'Falha no envio: ' + error.message;
        feedback.dataset.kind = 'error';
      } finally {
        uploadLabel.textContent = 'Adicionar anexos';
        uploadLabel.style.pointerEvents = '';
        uploadInput.value = '';
      }
    });
    uploadLabel.appendChild(uploadInput);
    area.appendChild(uploadLabel);
  }
  if (!data?.length) {
    const empty = window.document.createElement('p');
    empty.textContent = 'Este documento ainda não possui anexos.';
    area.appendChild(empty);
  }
  for (const item of data || []) {
    const line = document.createElement('div');
    line.className = 'anit-attachment-row';
    const label = document.createElement('span');
    label.textContent = item.file_name + ' · ' + (item.file_size / 1024).toFixed(0) + ' KB';
    const download = document.createElement('button');
    download.type = 'button'; download.className = 'btn btn-light btn-small'; download.textContent = 'Baixar';
    download.addEventListener('click', async () => {
      download.disabled = true;
      try {
        const { data: fileRow, error: fileError } = await neon.from('official_document_attachments')
          .select('file_name,content_type,file_data,checksum_sha256').eq('id',item.id).single();
        if (fileError) throw fileError;
        const raw = fileRow.file_data;
        if (typeof raw !== 'string' || !raw.startsWith('\\x')) throw new Error('Formato binário retornado pelo banco não reconhecido.');
        const hex = raw.slice(2);
        const bytes = new Uint8Array(hex.match(/.{1,2}/g).map(pair => parseInt(pair,16)));
        const digest = await crypto.subtle.digest('SHA-256', bytes);
        const checksum = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2,'0')).join('');
        if (checksum !== fileRow.checksum_sha256) throw new Error('A verificação de integridade do arquivo falhou.');
        const url = URL.createObjectURL(new Blob([bytes],{type:fileRow.content_type || 'application/octet-stream'}));
        const anchor = document.createElement('a');
        anchor.href = url; anchor.download = fileRow.file_name; anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1500);
        feedback.textContent = 'Download iniciado.';
        feedback.dataset.kind = 'success';
      } catch (error) {
        feedback.textContent = 'Não foi possível baixar o anexo: ' + error.message;
        feedback.dataset.kind = 'error';
      } finally { download.disabled = false; }
    });
    line.append(label,download);
    if (canManage('official_documents', currentProfile.role)) {
      const remove = window.document.createElement('button');
      remove.type = 'button'; remove.className = 'btn btn-danger btn-small'; remove.textContent = 'Excluir';
      remove.addEventListener('click', async () => {
        if (!window.confirm('Excluir permanentemente este anexo?')) return;
        const { error: removeError } = await neon.from('official_document_attachments').delete().eq('id',item.id);
        if (removeError) {
          feedback.textContent = 'Não foi possível excluir: ' + removeError.message;
          feedback.dataset.kind = 'error';
          return;
        }
        await showOfficialDocumentAttachments(docRecord);
      });
      line.appendChild(remove);
    }
    area.appendChild(line);
  }
  feedback.textContent = (data?.length || 0) + ' anexo(s) localizado(s).';
  feedback.dataset.kind = 'success';
  area.hidden = false;
}

const LEGAL_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
const LEGAL_ATTACHMENT_TYPES = new Map([
  ['pdf','application/pdf'],
  ['docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ['xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ['jpg','image/jpeg'], ['jpeg','image/jpeg'], ['png','image/png']
]);

async function uploadLegalCaseAttachments(caseId, files, userId) {
  if (!caseId) throw new Error('Demanda jurídica não identificada.');
  if (files.length > 10) throw new Error('Envie no máximo 10 anexos por operação.');
  for (const file of files) {
    const extension = (file.name.split('.').pop() || '').toLowerCase();
    const contentType = LEGAL_ATTACHMENT_TYPES.get(extension);
    if (!contentType) throw new Error('Formato não permitido: ' + file.name);
    if (file.size > LEGAL_ATTACHMENT_MAX_BYTES) throw new Error('O arquivo ' + file.name + ' ultrapassa 5 MB.');
    const buffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    const checksum = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2,'0')).join('');
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let offset=0; offset<bytes.length; offset+=0x8000) binary += String.fromCharCode(...bytes.subarray(offset,offset+0x8000));
    const safeName = Array.from(file.name).map(char => char === '/' || char === String.fromCharCode(92) || char.charCodeAt(0)<32 ? '_' : char).join('').slice(0,240);
    const { error } = await neon.rpc('store_legal_case_attachment', {
      p_case_id: caseId, p_file_name: safeName, p_content_type: contentType,
      p_file_base64: btoa(binary), p_checksum_sha256: checksum
    });
    if (error) throw new Error('Falha ao armazenar ' + safeName + ': ' + error.message);
  }
}

async function showLegalCaseDetails(caseRecord) {
  const panel = window.document.getElementById('data-legal_cases');
  const feedback = panel?.querySelector('.anit-feedback');
  const area = panel?.querySelector('.anit-legal-details');
  if (!panel || !area || !feedback) return;
  area.replaceChildren();
  area.hidden = false;
  const heading = window.document.createElement('h3');
  heading.textContent = 'Acompanhamento — ' + caseRecord.title;
  area.appendChild(heading);
  const canEdit = canManage('legal_cases',currentProfile.role);
  if (canEdit) {
    const updateForm = window.document.createElement('form');
    updateForm.className = 'field-grid anit-create-form';
    const dateField = window.document.createElement('div'); dateField.className='field';
    const dateLabel = window.document.createElement('label'); dateLabel.textContent='Data da atualização';
    const dateInput = window.document.createElement('input'); dateInput.type='date'; dateInput.required=true;
    dateInput.value = new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
    dateField.append(dateLabel,dateInput);
    const statusField = window.document.createElement('div'); statusField.className='field';
    const statusLabel = window.document.createElement('label'); statusLabel.textContent='Nova situação';
    const statusInput = window.document.createElement('select');
    ['open','in_analysis','awaiting_documents','awaiting_response','in_progress','decision_issued','appeal','suspended','closed','archived'].forEach(value=>{
      const option=window.document.createElement('option'); option.value=value; option.textContent=translateEnum(value); statusInput.appendChild(option);
    });
    statusInput.value=caseRecord.status; statusField.append(statusLabel,statusInput);
    const noteField = window.document.createElement('div'); noteField.className='field'; noteField.style.gridColumn='1 / -1';
    const noteLabel = window.document.createElement('label'); noteLabel.textContent='Descrição da movimentação / providência';
    const noteInput = window.document.createElement('textarea'); noteInput.rows=3; noteInput.placeholder='Descreva o andamento, decisão, contato ou providência...';
    noteField.append(noteLabel,noteInput);
    const saveUpdate = window.document.createElement('button'); saveUpdate.type='submit'; saveUpdate.className='btn btn-primary'; saveUpdate.textContent='Registrar atualização';
    updateForm.append(dateField,statusField,noteField,saveUpdate);
    updateForm.addEventListener('submit',async event=>{
      event.preventDefault(); saveUpdate.disabled=true;
      try {
        const nextStatus=statusInput.value;
        const {error:updateError}=await neon.rpc('update_legal_case_status',{
          p_case_id:caseRecord.id,p_new_status:nextStatus,p_event_date:dateInput.value,
          p_notes:noteInput.value.trim() || null
        });
        if(updateError) throw updateError;
        caseRecord.status=nextStatus;
        noteInput.value='';
        feedback.textContent='Atualização registrada no histórico.';
        feedback.dataset.kind='success';
        await loadTable(MODULES.find(item=>item.table==='legal_cases'));
        await showLegalCaseDetails(caseRecord);
      } catch(error) {
        feedback.textContent='Não foi possível registrar a atualização: '+error.message;
        feedback.dataset.kind='error';
      } finally { saveUpdate.disabled=false; }
    });
    area.appendChild(updateForm);
  }
  const attachmentTitle=window.document.createElement('h4'); attachmentTitle.textContent='Anexos do processo';
  area.appendChild(attachmentTitle);
  if (canEdit) {
    const uploadLabel=window.document.createElement('label'); uploadLabel.className='btn btn-primary btn-small'; uploadLabel.textContent='Adicionar anexos';
    const uploadInput=window.document.createElement('input'); uploadInput.type='file'; uploadInput.multiple=true; uploadInput.accept='.pdf,.docx,.xlsx,.jpg,.jpeg,.png'; uploadInput.hidden=true;
    uploadInput.addEventListener('change',async()=>{
      const files=[...uploadInput.files].filter(file=>file.size>0); if(!files.length)return;
      uploadLabel.textContent='Enviando...'; uploadLabel.style.pointerEvents='none';
      try { await uploadLegalCaseAttachments(caseRecord.id,files,currentUser.id); feedback.textContent='Anexos armazenados.'; feedback.dataset.kind='success'; await showLegalCaseDetails(caseRecord); }
      catch(error){feedback.textContent='Falha no envio: '+error.message;feedback.dataset.kind='error';}
      finally{uploadLabel.textContent='Adicionar anexos';uploadLabel.style.pointerEvents='';uploadInput.value='';}
    });
    uploadLabel.appendChild(uploadInput); area.appendChild(uploadLabel);
  }
  const [updatesResult,filesResult]=await Promise.all([
    neon.from('legal_case_updates').select('id,event_date,previous_status,new_status,notes,created_at').eq('case_id',caseRecord.id).order('event_date',{ascending:false}),
    neon.from('legal_case_attachments').select('id,file_name,content_type,file_size,created_at,checksum_sha256').eq('case_id',caseRecord.id).order('created_at',{ascending:false})
  ]);
  if(updatesResult.error || filesResult.error) {
    feedback.textContent='Não foi possível carregar todo o acompanhamento: '+(updatesResult.error?.message || filesResult.error?.message);
    feedback.dataset.kind='error'; return;
  }
  const historyTitle=window.document.createElement('h4'); historyTitle.textContent='Histórico de movimentações';
  area.appendChild(historyTitle);
  if(!updatesResult.data?.length) {
    const empty=window.document.createElement('p'); empty.textContent='Nenhuma movimentação registrada ainda.'; area.appendChild(empty);
  }
  for(const item of updatesResult.data || []) {
    const line=window.document.createElement('div'); line.className='anit-attachment-row';
    const label=window.document.createElement('span');
    label.textContent=new Date(item.event_date+'T12:00:00').toLocaleDateString('pt-BR')+' · '+translateEnum(item.new_status)+(item.previous_status?' (anterior: '+translateEnum(item.previous_status)+')':'')+(item.notes?' — '+item.notes:'');
    line.appendChild(label); area.appendChild(line);
  }
  const filesTitle=window.document.createElement('h4'); filesTitle.textContent='Arquivos anexados';
  area.appendChild(filesTitle);
  if(!filesResult.data?.length) {
    const empty=window.document.createElement('p'); empty.textContent='Nenhum anexo cadastrado.'; area.appendChild(empty);
  }
  for(const item of filesResult.data || []) {
    const line=window.document.createElement('div'); line.className='anit-attachment-row';
    const label=window.document.createElement('span'); label.textContent=item.file_name+' · '+(item.file_size/1024).toFixed(0)+' KB';
    const download=window.document.createElement('button'); download.type='button'; download.className='btn btn-light btn-small'; download.textContent='Baixar';
    download.addEventListener('click',async()=>{
      download.disabled=true;
      try {
        const {data:fileRow,error}=await neon.from('legal_case_attachments').select('file_name,content_type,file_data,checksum_sha256').eq('id',item.id).single();
        if(error)throw error;
        const raw=fileRow.file_data;
        if (typeof raw !== 'string' || !raw.startsWith('\\x')) throw new Error('Formato binário não reconhecido.');
        const bytes=new Uint8Array(raw.slice(2).match(/.{1,2}/g).map(pair=>parseInt(pair,16)));
        const digest=await crypto.subtle.digest('SHA-256',bytes);
        const checksum=[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
        if(checksum!==fileRow.checksum_sha256)throw new Error('Falha na verificação de integridade SHA-256.');
        const url=URL.createObjectURL(new Blob([bytes],{type:fileRow.content_type}));
        const link=window.document.createElement('a'); link.href=url; link.download=fileRow.file_name; link.click();
        window.setTimeout(()=>URL.revokeObjectURL(url),1500);
      } catch(error){feedback.textContent='Não foi possível baixar: '+error.message;feedback.dataset.kind='error';}
      finally{download.disabled=false;}
    });
    line.append(label,download);
    if(canEdit) {
      const remove=window.document.createElement('button'); remove.type='button'; remove.className='btn btn-danger btn-small'; remove.textContent='Excluir';
      remove.addEventListener('click',async()=>{
        if(!window.confirm('Excluir este anexo permanentemente?'))return;
        const {error}=await neon.from('legal_case_attachments').delete().eq('id',item.id);
        if(error){feedback.textContent='Não foi possível excluir: '+error.message;feedback.dataset.kind='error';return;}
        await showLegalCaseDetails(caseRecord);
      });
      line.appendChild(remove);
    }
    area.appendChild(line);
  }
}

async function uploadInstitutionalAttachments(relationId, files) {
  if (!relationId) throw new Error('Relação institucional não identificada.');
  if (files.length > 10) throw new Error('Envie no máximo 10 anexos por operação.');
  for (const file of files) {
    const extension=(file.name.split('.').pop()||'').toLowerCase();
    const contentType=LEGAL_ATTACHMENT_TYPES.get(extension);
    if(!contentType) throw new Error('Formato não permitido: '+file.name);
    if(file.size>LEGAL_ATTACHMENT_MAX_BYTES) throw new Error('O arquivo '+file.name+' ultrapassa 5 MB.');
    const buffer=await file.arrayBuffer();
    const digest=await crypto.subtle.digest('SHA-256',buffer);
    const checksum=[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
    const bytes=new Uint8Array(buffer); let binary='';
    for(let offset=0;offset<bytes.length;offset+=0x8000) binary+=String.fromCharCode(...bytes.subarray(offset,offset+0x8000));
    const safeName=Array.from(file.name).map(char=>char==='/'||char===String.fromCharCode(92)||char.charCodeAt(0)<32?'_':char).join('').slice(0,240);
    const {error}=await neon.rpc('store_institutional_relation_attachment',{
      p_relation_id:relationId,p_file_name:safeName,p_content_type:contentType,
      p_file_base64:btoa(binary),p_checksum_sha256:checksum
    });
    if(error) throw new Error('Falha ao armazenar '+safeName+': '+error.message);
  }
}

async function showInstitutionalRelationDetails(record) {
  const panel=window.document.getElementById('data-institutional_relations');
  const feedback=panel?.querySelector('.anit-feedback');
  const area=panel?.querySelector('.anit-legal-details');
  if(!panel||!area||!feedback)return;
  area.replaceChildren(); area.hidden=false;
  const heading=window.document.createElement('h3');
  heading.textContent='Acompanhamento institucional — '+record.institution;
  area.appendChild(heading);
  const canEdit=canManage('institutional_relations',currentProfile.role);
  if(canEdit) {
    const form=window.document.createElement('form'); form.className='field-grid anit-create-form';
    const dateField=window.document.createElement('div'); dateField.className='field';
    const dateLabel=window.document.createElement('label'); dateLabel.textContent='Data da movimentação';
    const dateInput=window.document.createElement('input'); dateInput.type='date'; dateInput.required=true;
    dateInput.value=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
    dateField.append(dateLabel,dateInput);
    const statusField=window.document.createElement('div'); statusField.className='field';
    const statusLabel=window.document.createElement('label'); statusLabel.textContent='Nova situação';
    const statusInput=window.document.createElement('select');
    ['active','in_contact','awaiting_response','meeting_scheduled','in_negotiation','paused','completed','closed'].forEach(value=>{
      const option=window.document.createElement('option'); option.value=value; option.textContent=translateEnum(value); statusInput.appendChild(option);
    });
    statusInput.value=record.status; statusField.append(statusLabel,statusInput);
    const notesField=window.document.createElement('div'); notesField.className='field'; notesField.style.gridColumn='1 / -1';
    const notesLabel=window.document.createElement('label'); notesLabel.textContent='Registro do contato, decisão ou providência';
    const notesInput=window.document.createElement('textarea'); notesInput.rows=3; notesInput.placeholder='Descreva ofício enviado, reunião, resposta, encaminhamento ou compromisso...';
    notesField.append(notesLabel,notesInput);
    const save=window.document.createElement('button'); save.type='submit'; save.className='btn btn-primary'; save.textContent='Registrar movimentação';
    form.append(dateField,statusField,notesField,save);
    form.addEventListener('submit',async event=>{
      event.preventDefault(); save.disabled=true;
      try {
        const {error}=await neon.rpc('update_institutional_relation_status',{
          p_relation_id:record.id,p_new_status:statusInput.value,p_event_date:dateInput.value,p_notes:notesInput.value.trim()||null
        });
        if(error)throw error;
        record.status=statusInput.value;
        feedback.textContent='Movimentação institucional registrada.';
        feedback.dataset.kind='success';
        await loadTable(MODULES.find(item=>item.table==='institutional_relations'));
        await showInstitutionalRelationDetails(record);
      } catch(error) {
        feedback.textContent='Não foi possível registrar a movimentação: '+error.message;
        feedback.dataset.kind='error';
      } finally {save.disabled=false;}
    });
    area.appendChild(form);
  }
  const attachTitle=window.document.createElement('h4'); attachTitle.textContent='Ofícios, documentos e anexos';
  area.appendChild(attachTitle);
  if(canEdit) {
    const label=window.document.createElement('label'); label.className='btn btn-primary btn-small'; label.textContent='Adicionar anexos';
    const input=window.document.createElement('input'); input.type='file'; input.multiple=true; input.accept='.pdf,.docx,.xlsx,.jpg,.jpeg,.png'; input.hidden=true;
    input.addEventListener('change',async()=>{
      const files=[...input.files].filter(file=>file.size>0); if(!files.length)return;
      label.textContent='Enviando...'; label.style.pointerEvents='none';
      try {await uploadInstitutionalAttachments(record.id,files); feedback.textContent='Anexos armazenados com segurança.'; feedback.dataset.kind='success'; await showInstitutionalRelationDetails(record);}
      catch(error){feedback.textContent='Falha no envio: '+error.message;feedback.dataset.kind='error';}
      finally{label.textContent='Adicionar anexos';label.style.pointerEvents='';input.value='';}
    });
    label.appendChild(input); area.appendChild(label);
  }
  const [history,files]=await Promise.all([
    neon.from('institutional_relation_updates').select('id,event_date,previous_status,new_status,notes').eq('relation_id',record.id).order('event_date',{ascending:false}),
    neon.from('institutional_relation_attachments').select('id,file_name,file_size,created_at').eq('relation_id',record.id).order('created_at',{ascending:false})
  ]);
  if(history.error||files.error){feedback.textContent='Falha ao carregar histórico/anexos: '+(history.error?.message||files.error?.message);feedback.dataset.kind='error';return;}
  const historyTitle=window.document.createElement('h4'); historyTitle.textContent='Histórico de relacionamento';
  area.appendChild(historyTitle);
  if(!history.data?.length){const empty=window.document.createElement('p');empty.textContent='Nenhuma movimentação registrada.';area.appendChild(empty);}
  for(const item of history.data||[]){
    const line=window.document.createElement('div');line.className='anit-attachment-row';
    const label=window.document.createElement('span');
    label.textContent=new Date(item.event_date+'T12:00:00').toLocaleDateString('pt-BR')+' · '+translateEnum(item.new_status)+(item.previous_status?' (anterior: '+translateEnum(item.previous_status)+')':'')+(item.notes?' — '+item.notes:'');
    line.appendChild(label);area.appendChild(line);
  }
  const filesTitle=window.document.createElement('h4');filesTitle.textContent='Arquivos anexados';
  area.appendChild(filesTitle);
  if(!files.data?.length){const empty=window.document.createElement('p');empty.textContent='Nenhum anexo cadastrado.';area.appendChild(empty);}
  for(const item of files.data||[]){
    const line=window.document.createElement('div');line.className='anit-attachment-row';
    const label=window.document.createElement('span');label.textContent=item.file_name+' · '+(item.file_size/1024).toFixed(0)+' KB';
    const download=window.document.createElement('button');download.type='button';download.className='btn btn-light btn-small';download.textContent='Baixar';
    download.addEventListener('click',async()=>{
      download.disabled=true;
      try{
        const {data:fileRow,error}=await neon.from('institutional_relation_attachments').select('file_name,content_type,file_data,checksum_sha256').eq('id',item.id).single();
        if(error)throw error;
        const raw=fileRow.file_data;
        if(typeof raw!=='string'||!raw.startsWith('\\x'))throw new Error('Formato binário não reconhecido.');
        const bytes=new Uint8Array(raw.slice(2).match(/.{1,2}/g).map(pair=>parseInt(pair,16)));
        const digest=await crypto.subtle.digest('SHA-256',bytes);
        const checksum=[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
        if(checksum!==fileRow.checksum_sha256)throw new Error('Falha na verificação de integridade SHA-256.');
        const url=URL.createObjectURL(new Blob([bytes],{type:fileRow.content_type}));
        const link=window.document.createElement('a');link.href=url;link.download=fileRow.file_name;link.click();
        window.setTimeout(()=>URL.revokeObjectURL(url),1500);
      }catch(error){feedback.textContent='Não foi possível baixar: '+error.message;feedback.dataset.kind='error';}
      finally{download.disabled=false;}
    });
    line.append(label,download);
    if(canEdit){
      const remove=window.document.createElement('button');remove.type='button';remove.className='btn btn-danger btn-small';remove.textContent='Excluir';
      remove.addEventListener('click',async()=>{
        if(!window.confirm('Excluir este anexo permanentemente?'))return;
        const {error}=await neon.from('institutional_relation_attachments').delete().eq('id',item.id);
        if(error){feedback.textContent='Não foi possível excluir: '+error.message;feedback.dataset.kind='error';return;}
        await showInstitutionalRelationDetails(record);
      });
      line.appendChild(remove);
    }
    area.appendChild(line);
  }
}


const MEETING_MIMES={pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png'};
async function uploadMeetingAttachments(meetingId,files){
 if(!meetingId||files.length>10)throw new Error('Reunião inválida ou limite de 10 arquivos excedido.');
 for(const file of files){
  const ext=(file.name.split('.').pop()||'').toLowerCase(),mime=MEETING_MIMES[ext];
  if(!mime||file.size>5242880)throw new Error('Formato não permitido ou arquivo maior que 5 MB: '+file.name);
  const buf=await file.arrayBuffer(),hash=await crypto.subtle.digest('SHA-256',buf),sum=[...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join('');
  const bytes=new Uint8Array(buf);let bin='';for(let i=0;i<bytes.length;i+=32768)bin+=String.fromCharCode(...bytes.subarray(i,i+32768));
  const safe=file.name.replace(/[\\/\\x00-\\x1f]/g,'_').slice(0,240);
  const {error}=await neon.rpc('store_meeting_attachment',{p_meeting_id:meetingId,p_file_name:safe,p_content_type:mime,p_file_base64:btoa(bin),p_checksum_sha256:sum});
  if(error)throw error;
 }
}
async function renderMeetingCalendar(){
 const area=document.querySelector('#data-meetings .anit-meeting-calendar');if(!area)return;
 const {data,error}=await neon.from('meetings').select('id,meeting_number,title,meeting_type,starts_at,ends_at,location,status,meeting_mode').order('starts_at').limit(300);
 area.replaceChildren();const h=document.createElement('h3');h.textContent='Agenda institucional';area.append(h);
 if(error){area.append(document.createTextNode('Falha ao carregar agenda: '+error.message));return;}
 const now=new Date(),future=(data||[]).filter(x=>x.status==='scheduled'&&new Date(x.starts_at)>=now),held=(data||[]).filter(x=>x.status==='held'),cancelled=(data||[]).filter(x=>x.status==='cancelled');
 const stats=document.createElement('p');stats.textContent='Próximas: '+future.length+' · Realizadas: '+held.length+' · Canceladas: '+cancelled.length;area.append(stats);
 const grid=document.createElement('div');grid.className='anit-upcoming-meetings';
 if(!future.length){const p=document.createElement('p');p.textContent='Nenhuma reunião futura agendada.';grid.append(p);}
 future.slice(0,8).forEach(item=>{const card=document.createElement('div');card.className='anit-meeting-card';const title=document.createElement('strong');title.textContent=item.title;const date=document.createElement('p');date.textContent=new Date(item.starts_at).toLocaleString('pt-BR')+' · '+(item.location||translateEnum(item.meeting_mode));const open=document.createElement('button');open.type='button';open.className='btn btn-light btn-small';open.textContent='Abrir relatório';open.addEventListener('click',()=>showMeetingDetails(item));card.append(title,date,open);grid.append(card);});
 area.append(grid);
}
async function showMeetingDetails(record){
 const panel=document.getElementById('data-meetings'),area=panel?.querySelector('.anit-meeting-workspace'),feedback=panel?.querySelector('.anit-feedback');if(!area)return;
 area.replaceChildren();area.hidden=false;
 const h=document.createElement('h3');h.textContent='Relatório e acompanhamento — '+record.title;area.append(h);
 const report=document.createElement('div');report.className='anit-meeting-report';
 const add=(title,value)=>{const head=document.createElement('h4');head.textContent=title;const p=document.createElement('p');p.style.whiteSpace='pre-wrap';p.textContent=value||'Não informado.';report.append(head,p);};
 const meta=document.createElement('p');meta.textContent='Reunião nº '+(record.meeting_number||'—')+' · '+new Date(record.starts_at).toLocaleString('pt-BR')+' · '+translateEnum(record.status);report.append(meta);
 add('Pauta',record.agenda);add('Participantes',record.participants_summary);add('Relato / ata',record.report_body);add('Deliberações',record.decisions);area.append(report);
 const print=document.createElement('button');print.type='button';print.className='btn btn-light';print.textContent='Imprimir relatório / ata';print.onclick=()=>{const w=window.open('','_blank');if(!w){feedback.textContent='Permita pop-ups para imprimir.';return;}w.document.write('<meta charset="utf-8"><title>Relatório ANIT</title><style>body{font:14px Arial;margin:36px;color:#17324d}p{white-space:pre-wrap;line-height:1.5}</style><h1>ANIT — Relatório de reunião</h1><h2>'+String(record.title).replace(/[&<>]/g,'')+'</h2>'+report.innerHTML);w.document.close();w.print();};area.append(print);
 const can=canManage('meetings',currentProfile.role);
 const heading=(text)=>{const x=document.createElement('h4');x.textContent=text;area.append(x);};
 heading('Participantes e presença');
 if(can){
  const form=document.createElement('form');form.className='field-grid anit-create-form';
  const input=(label,type,required)=>{const d=document.createElement('div');d.className='field';const l=document.createElement('label');l.textContent=label;const i=document.createElement('input');i.type=type;i.required=!!required;d.append(l,i);form.append(d);return i;};
  const name=input('Nome completo','text',true),role=input('Cargo / instituição','text'),email=input('E-mail','email');
  const d=document.createElement('div');d.className='field';const l=document.createElement('label');l.textContent='Presença';const status=document.createElement('select');[['invited','Convidado'],['confirmed','Confirmado'],['present','Presente'],['absent','Ausente'],['excused','Justificado']].forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;status.append(o);});d.append(l,status);form.append(d);
  const save=document.createElement('button');save.type='submit';save.className='btn btn-primary';save.textContent='Adicionar participante';form.append(save);
  form.onsubmit=async e=>{e.preventDefault();save.disabled=true;const {error}=await neon.from('meeting_attendees').insert({meeting_id:record.id,full_name:name.value,role_or_organization:role.value||null,email:email.value||null,attendance_status:status.value,created_by:currentUser.id});if(error){feedback.textContent=error.message;feedback.dataset.kind='error';}else await showMeetingDetails(record);save.disabled=false;};area.append(form);
 }
 const attendees=await neon.from('meeting_attendees').select('full_name,role_or_organization,attendance_status').eq('meeting_id',record.id).order('created_at');
 if(attendees.error){feedback.textContent=attendees.error.message;feedback.dataset.kind='error';}else{const ul=document.createElement('ul');(attendees.data||[]).forEach(x=>{const li=document.createElement('li');li.textContent=x.full_name+' · '+(x.role_or_organization||'')+' · '+translateEnum(x.attendance_status);ul.append(li);});area.append(ul);}
 heading('Encaminhamentos e responsáveis');
 if(can){
  const form=document.createElement('form');form.className='field-grid anit-create-form';
  const input=(label,type)=>{const d=document.createElement('div');d.className='field';const l=document.createElement('label');l.textContent=label;const i=document.createElement('input');i.type=type;i.required=true;d.append(l,i);form.append(d);return i;};
  const task=input('Providência / tarefa','text'),owner=input('Responsável','text'),due=input('Prazo','date');const save=document.createElement('button');save.type='submit';save.className='btn btn-primary';save.textContent='Adicionar encaminhamento';form.append(save);
  form.onsubmit=async e=>{e.preventDefault();save.disabled=true;const {error}=await neon.from('meeting_action_items').insert({meeting_id:record.id,description:task.value,responsible:owner.value,due_date:due.value||null,created_by:currentUser.id});if(error){feedback.textContent=error.message;feedback.dataset.kind='error';}else await showMeetingDetails(record);save.disabled=false;};area.append(form);
 }
 const tasks=await neon.from('meeting_action_items').select('description,responsible,due_date,status').eq('meeting_id',record.id).order('due_date');
 if(tasks.error){feedback.textContent=tasks.error.message;feedback.dataset.kind='error';}else{const ul=document.createElement('ul');(tasks.data||[]).forEach(x=>{const li=document.createElement('li');li.textContent=x.description+' — '+x.responsible+' · '+(x.due_date||'sem prazo')+' · '+translateEnum(x.status);ul.append(li);});area.append(ul);}
 heading('Atas, convocações e documentos');
 if(can){const label=document.createElement('label');label.className='btn btn-primary btn-small';label.textContent='Adicionar anexos';const file=document.createElement('input');file.type='file';file.multiple=true;file.hidden=true;file.accept='.pdf,.docx,.xlsx,.pptx,.jpg,.jpeg,.png';file.onchange=async()=>{const list=[...file.files].filter(x=>x.size>0);if(!list.length)return;try{await uploadMeetingAttachments(record.id,list);await showMeetingDetails(record);}catch(e){feedback.textContent='Falha no envio: '+e.message;feedback.dataset.kind='error';}finally{file.value='';}};label.append(file);area.append(label);}
 const files=await neon.from('meeting_attachments').select('id,file_name,file_size').eq('meeting_id',record.id).order('created_at',{ascending:false});
 if(files.error){feedback.textContent=files.error.message;feedback.dataset.kind='error';}else for(const item of files.data||[]){const row=document.createElement('div');row.className='anit-attachment-row';const name=document.createElement('span');name.textContent=item.file_name+' · '+Math.ceil(item.file_size/1024)+' KB';const download=document.createElement('button');download.type='button';download.className='btn btn-light btn-small';download.textContent='Baixar';download.onclick=async()=>{try{const {data,error}=await neon.from('meeting_attachments').select('file_name,content_type,file_data,checksum_sha256').eq('id',item.id).single();if(error)throw error;const raw=data.file_data;if(typeof raw!=='string'||!raw.startsWith('\\x'))throw new Error('Formato binário não reconhecido');const bytes=new Uint8Array(raw.slice(2).match(/.{1,2}/g).map(v=>parseInt(v,16))),hash=await crypto.subtle.digest('SHA-256',bytes),sum=[...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join('');if(sum!==data.checksum_sha256)throw new Error('Falha na integridade SHA-256');const url=URL.createObjectURL(new Blob([bytes],{type:data.content_type})),a=document.createElement('a');a.href=url;a.download=data.file_name;a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1500);}catch(e){feedback.textContent=e.message;feedback.dataset.kind='error';}};row.append(name,download);area.append(row);}
}

async function renderMeetingCalendar(){
 const area=document.querySelector('#data-meetings .anit-meeting-calendar');if(!area)return;
 const result=await neon.from('meetings').select('id,meeting_number,title,meeting_type,starts_at,location,status,meeting_mode').order('starts_at').limit(300);area.replaceChildren();
 const h=document.createElement('h3');h.textContent='Agenda institucional';area.append(h);if(result.error){area.append(document.createTextNode('Falha ao carregar agenda: '+result.error.message));return;}
 const now=new Date(),rows=result.data||[],future=rows.filter(x=>x.status==='scheduled'&&new Date(x.starts_at)>=now),done=rows.filter(x=>x.status==='held'),cancel=rows.filter(x=>x.status==='cancelled');
 const stats=document.createElement('p');stats.textContent='Próximas: '+future.length+' · Realizadas: '+done.length+' · Canceladas: '+cancel.length;area.append(stats);
 const grid=document.createElement('div');grid.className='anit-upcoming-meetings';if(!future.length){const p=document.createElement('p');p.textContent='Nenhuma reunião futura agendada.';grid.append(p);}
 future.slice(0,8).forEach(x=>{const card=document.createElement('div');card.className='anit-meeting-card';const title=document.createElement('strong');title.textContent=x.title;const p=document.createElement('p');p.textContent=new Date(x.starts_at).toLocaleString('pt-BR')+' · '+(x.location||translateEnum(x.meeting_mode));const b=document.createElement('button');b.type='button';b.className='btn btn-light btn-small';b.textContent='Abrir relatório';b.onclick=()=>showMeetingDetails(x);card.append(title,p,b);grid.append(card);});area.append(grid);
}
async function showMeetingDetails(record){
 const panel=document.getElementById('data-meetings'),area=panel?.querySelector('.anit-meeting-workspace'),feedback=panel?.querySelector('.anit-feedback');if(!area)return;area.replaceChildren();area.hidden=false;
 const h=document.createElement('h3');h.textContent='Relatório e acompanhamento — '+record.title;area.append(h);
 const report=document.createElement('div');report.className='anit-meeting-report';
 const add=(title,value)=>{const head=document.createElement('h4');head.textContent=title;const p=document.createElement('p');p.style.whiteSpace='pre-wrap';p.textContent=value||'Não informado.';report.append(head,p);};
 const meta=document.createElement('p');meta.textContent='Reunião nº '+(record.meeting_number||'—')+' · '+new Date(record.starts_at).toLocaleString('pt-BR')+' · '+translateEnum(record.status);report.append(meta);
 add('Pauta',record.agenda);add('Participantes',record.participants_summary);add('Relato / ata',record.report_body);add('Deliberações',record.decisions);area.append(report);
 const print=document.createElement('button');print.type='button';print.className='btn btn-light';print.textContent='Imprimir relatório / ata';print.onclick=()=>{const w=window.open('','_blank');if(!w){feedback.textContent='Permita pop-ups para imprimir.';return;}w.document.write('<meta charset=utf-8><title>Relatório ANIT</title><h1>ANIT — Relatório de reunião</h1>'+report.innerHTML);w.document.close();w.print();};area.append(print);
 const can=canManage('meetings',currentProfile.role),section=t=>{const x=document.createElement('h4');x.textContent=t;area.append(x);};
 section('Participantes e presença');
 if(can){const f=document.createElement('form');f.className='field-grid anit-create-form';const mk=(label,type,req)=>{const d=document.createElement('div');d.className='field';const l=document.createElement('label');l.textContent=label;const i=document.createElement('input');i.type=type;i.required=!!req;d.append(l,i);f.append(d);return i;};const name=mk('Nome completo','text',true),role=mk('Cargo / instituição','text'),email=mk('E-mail','email');const d=document.createElement('div');d.className='field';const l=document.createElement('label');l.textContent='Presença';const status=document.createElement('select');[['invited','Convidado'],['confirmed','Confirmado'],['present','Presente'],['absent','Ausente'],['excused','Justificado']].forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;status.append(o);});d.append(l,status);f.append(d);const b=document.createElement('button');b.type='submit';b.className='btn btn-primary';b.textContent='Adicionar participante';f.append(b);f.onsubmit=async e=>{e.preventDefault();b.disabled=true;const {error}=await neon.from('meeting_attendees').insert({meeting_id:record.id,full_name:name.value,role_or_organization:role.value||null,email:email.value||null,attendance_status:status.value,created_by:currentUser.id});if(error){feedback.textContent=error.message;feedback.dataset.kind='error';}else await showMeetingDetails(record);b.disabled=false;};area.append(f);}
 const people=await neon.from('meeting_attendees').select('full_name,role_or_organization,attendance_status').eq('meeting_id',record.id).order('created_at');if(people.error){feedback.textContent=people.error.message;}else{const ul=document.createElement('ul');(people.data||[]).forEach(x=>{const li=document.createElement('li');li.textContent=x.full_name+' · '+(x.role_or_organization||'')+' · '+translateEnum(x.attendance_status);ul.append(li);});area.append(ul);}
 section('Encaminhamentos e responsáveis');
 if(can){const f=document.createElement('form');f.className='field-grid anit-create-form';const mk=(label,type)=>{const d=document.createElement('div');d.className='field';const l=document.createElement('label');l.textContent=label;const i=document.createElement('input');i.type=type;i.required=true;d.append(l,i);f.append(d);return i;};const desc=mk('Providência / tarefa','text'),owner=mk('Responsável','text'),due=mk('Prazo','date');const b=document.createElement('button');b.type='submit';b.className='btn btn-primary';b.textContent='Adicionar encaminhamento';f.append(b);f.onsubmit=async e=>{e.preventDefault();b.disabled=true;const {error}=await neon.from('meeting_action_items').insert({meeting_id:record.id,description:desc.value,responsible:owner.value,due_date:due.value||null,created_by:currentUser.id});if(error){feedback.textContent=error.message;feedback.dataset.kind='error';}else await showMeetingDetails(record);b.disabled=false;};area.append(f);}
 const tasks=await neon.from('meeting_action_items').select('description,responsible,due_date,status').eq('meeting_id',record.id).order('due_date');if(tasks.error){feedback.textContent=tasks.error.message;}else{const ul=document.createElement('ul');(tasks.data||[]).forEach(x=>{const li=document.createElement('li');li.textContent=x.description+' — '+x.responsible+' · '+(x.due_date||'sem prazo')+' · '+translateEnum(x.status);ul.append(li);});area.append(ul);}
 section('Atas, convocações e documentos');
 if(can){const label=document.createElement('label');label.className='btn btn-primary btn-small';label.textContent='Adicionar anexos';const input=document.createElement('input');input.type='file';input.multiple=true;input.hidden=true;input.accept='.pdf,.docx,.xlsx,.pptx,.jpg,.jpeg,.png';input.onchange=async()=>{const list=[...input.files].filter(x=>x.size>0);if(!list.length)return;try{await uploadMeetingAttachments(record.id,list);await showMeetingDetails(record);}catch(e){feedback.textContent='Falha no envio: '+e.message;feedback.dataset.kind='error';}finally{input.value='';}};label.append(input);area.append(label);}
 const files=await neon.from('meeting_attachments').select('id,file_name,file_size').eq('meeting_id',record.id).order('created_at',{ascending:false});if(files.error){feedback.textContent=files.error.message;}else for(const item of files.data||[]){const row=document.createElement('div');row.className='anit-attachment-row';const name=document.createElement('span');name.textContent=item.file_name+' · '+Math.ceil(item.file_size/1024)+' KB';const b=document.createElement('button');b.type='button';b.className='btn btn-light btn-small';b.textContent='Baixar';b.onclick=async()=>{try{const {data,error}=await neon.from('meeting_attachments').select('file_name,content_type,file_data,checksum_sha256').eq('id',item.id).single();if(error)throw error;const raw=data.file_data;if(typeof raw!=='string'||!raw.startsWith('\\x'))throw new Error('Formato binário não reconhecido');const bytes=new Uint8Array(raw.slice(2).match(/.{1,2}/g).map(v=>parseInt(v,16))),hash=await crypto.subtle.digest('SHA-256',bytes),sum=[...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join('');if(sum!==data.checksum_sha256)throw new Error('Falha na integridade SHA-256');const url=URL.createObjectURL(new Blob([bytes],{type:data.content_type})),a=document.createElement('a');a.href=url;a.download=data.file_name;a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1500);}catch(e){feedback.textContent=e.message;feedback.dataset.kind='error';}};row.append(name,b);area.append(row);}
}
async function loadTable(module) {
  const panel = document.getElementById('data-' + module.table);
  if (!panel) return;
  const wrap = panel.querySelector('.anit-table-wrap');
  if (module.table === 'meetings') await renderMeetingCalendar();
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
    th.textContent = formatColumnLabel(column);
    headerRow.appendChild(th);
  });
  if (canManage(module.table,currentProfile.role) || ['official_documents','legal_cases','institutional_relations'].includes(module.table)) {
    const th=document.createElement('th'); th.textContent='Ações'; headerRow.appendChild(th);
  }
  head.appendChild(headerRow); table.appendChild(head);
  const body = document.createElement('tbody');
  rows.forEach(row => {
    const tr = document.createElement('tr');
    module.columns.forEach(column => {
      const td = document.createElement('td');
      const value = row[column];
      td.textContent = value == null ? '—' : (typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value) ? new Date(value).toLocaleString('pt-BR') : translateEnum(value));
      tr.appendChild(td);
    });
    if (canManage(module.table,currentProfile.role) || ['official_documents','legal_cases'].includes(module.table)) {
      const actions=document.createElement('td');
      if (module.table === 'institutional_relations') {
        const followup=document.createElement('button'); followup.type='button'; followup.className='btn btn-light btn-small'; followup.textContent='Acompanhamento';
        followup.addEventListener('click',()=>showInstitutionalRelationDetails(row)); actions.append(followup);
      }
      if (module.table === 'legal_cases') {
        const followup=document.createElement('button'); followup.type='button'; followup.className='btn btn-light btn-small'; followup.textContent='Acompanhamento';
        followup.addEventListener('click',()=>showLegalCaseDetails(row)); actions.append(followup);
      }
      if (module.table === 'official_documents') {
        const attachments = document.createElement('button');
        attachments.type='button'; attachments.className='btn btn-light btn-small'; attachments.textContent='Anexos';
        attachments.addEventListener('click',()=>showOfficialDocumentAttachments(row));
        actions.append(attachments);
      }
      if (canManage(module.table,currentProfile.role)) {
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
        actions.append(edit,del);
      }
      tr.appendChild(actions);
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
  // Reuse the same Neon client instance that completed sign-in.
  // Recreating it here can lose the in-memory auth state before profile loading.
  if (!neon) {
    neon = createClient({
      auth: { url: AUTH_URL },
      dataApi: { url: DATA_API_URL, options: { db: { schema: 'anit' } } }
    });
  }
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
  for (const module of MODULES.filter(item => roleAllowed(item.section, currentProfile.role))) {
    await addDataPanel(module);
  }
  await loadDashboardStats();
  await loadAudit();
  await loadUsersAndPermissions();
  await loadReports();
  await loadSettings();
}

form?.addEventListener('submit', async event => {
  event.preventDefault();
  clearMessage();
  const submit = form.querySelector('button[type="submit"]');
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!email || !password) {
    showMessage('Informe seu e-mail e sua senha para continuar.');
    return;
  }
  if (!AUTH_URL || !DATA_API_URL) {
    showMessage('A autenticação da Central ANIT não está configurada. Avise o administrador.');
    return;
  }

  if (submit) {
    submit.disabled = true;
    submit.textContent = 'Verificando acesso...';
  }

  try {
    if (!neon) {
      neon = createClient({
        auth: { url: AUTH_URL },
        dataApi: { url: DATA_API_URL, options: { db: { schema: 'anit' } } }
      });
    }

    const result = await neon.auth.signIn.email({ email, password, rememberMe: true });
    if (result?.error) {
      showMessage('Não foi possível autenticar. Verifique e-mail, senha e confirmação do e-mail cadastrado.');
      return;
    }

    const sessionResult = await neon.auth.getSession();
    if (sessionResult?.error) {
      showMessage('A senha foi aceita, mas não foi possível confirmar a sessão. Tente novamente; se persistir, informe o administrador.');
      return;
    }
    if (!sessionResult?.data?.session || !sessionResult?.data?.user) {
      showMessage('A autenticação não criou uma sessão ativa. Verifique se o e-mail está confirmado e tente novamente.');
      return;
    }

    await boot();
    if (authGate && !authGate.hidden) {
      if (!message.textContent.trim()) {
        showMessage('A conta foi autenticada, mas o perfil institucional não foi carregado. Solicite a conferência do seu cadastro à administração.');
      }
    }
  } catch (error) {
    console.error('Falha no login da Central ANIT:', error);
    showMessage('Ocorreu uma falha ao concluir o login. Seus dados não foram alterados. Tente novamente ou envie esta informação ao suporte da ANIT.');
  } finally {
    if (submit) {
      submit.disabled = false;
      submit.textContent = 'Entrar com segurança';
    }
  }
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