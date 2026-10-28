export const COMPANY_KEY = 'pulse-companies-v1';
export const escapeHTML = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const fields = {name:60,legalName:120,document:32,city:80,state:2,mithraId:80,notes:300};
const validPhoto = value => typeof value === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value) && value.length <= 3000000;
export class CompanyStore {
  constructor(storage) {
    this.storage = storage;
    this.problem = '';
    try {
      const raw = storage.getItem(COMPANY_KEY);
      if (raw) {
        const state = JSON.parse(raw);
        if (state.schema !== 1 || !Array.isArray(state.companies) || !state.companies.length) throw new Error();
        const ids = new Set();
        for (const company of state.companies) {
          if (!company || typeof company.id !== 'string' || !company.id || ids.has(company.id) || typeof company.name !== 'string' || !company.name.trim()) throw new Error();
          ids.add(company.id);
          for (const field of Object.keys(fields)) company[field] = String(company[field] ?? '').slice(0,fields[field]);
          company.photo = validPhoto(company.photo) ? company.photo : '';
          company.demoEnabled = company.demoEnabled === true;
        }
        if (!ids.has(state.activeId)) state.activeId = state.companies[0].id;
        this.data = state;
      } else {
        const photo = storage.getItem('analytics-photo');
        this.data = {schema:1,activeId:'company-initial',companies:[{id:'company-initial',name:'Empresa 1',legalName:'',document:'',city:'',state:'',mithraId:'',notes:'',photo:validPhoto(photo)?photo:'',demoEnabled:true}]};
        this.storage.setItem(COMPANY_KEY,JSON.stringify(this.data));
      }
    } catch {
      this.problem = 'Não foi possível carregar ou salvar as empresas. Os dados existentes foram preservados. Verifique o armazenamento do aplicativo.';
      this.data ??= {schema:1,activeId:'company-initial',companies:[{id:'company-initial',name:'Empresa 1',demoEnabled:true,photo:''}]};
    }
  }
  get active() { return structuredClone(this.data.companies.find(c=>c.id===this.data.activeId)); }
  get companies() { return structuredClone(this.data.companies); }
  commit(next) {
    if (this.problem) throw new Error(this.problem);
    try { this.storage.setItem(COMPANY_KEY,JSON.stringify(next)); }
    catch { throw new Error('Não foi possível salvar. O armazenamento pode estar cheio. Nenhum dado foi alterado.'); }
    this.data = next;
  }
  select(id) {
    if (!this.data.companies.some(c=>c.id===id)) throw new Error('Empresa não encontrada.');
    this.commit({...this.data,activeId:id});
  }
  save(input,id=null) {
    if (id && !this.data.companies.some(c=>c.id===id)) throw new Error('Empresa não encontrada.');
    const values = {};
    for (const [key,max] of Object.entries(fields)) {
      values[key] = String(input[key] ?? '').trim();
      if (values[key].length > max) throw new Error('O campo '+key+' excedeu o tamanho permitido.');
    }
    if (!values.name) throw new Error('Informe o nome que aparecerá na aba da empresa.');
    if (this.data.companies.some(c=>c.id!==id && c.name.toLocaleLowerCase('pt-BR')===values.name.toLocaleLowerCase('pt-BR'))) throw new Error('Use nomes diferentes para identificar as abas das empresas.');
    const next = structuredClone(this.data);
    const company = { ...(id?next.companies.find(c=>c.id===id):{id:crypto.randomUUID(),photo:''}), ...values, state:values.state.toUpperCase(), demoEnabled:input.demoEnabled===true };
    if (id) next.companies[next.companies.findIndex(c=>c.id===id)] = company;
    else next.companies.push(company);
    next.activeId = company.id;
    this.commit(next);
    return company.id;
  }
  savePhoto(id,photo) {
    if (!validPhoto(photo)) throw new Error('Imagem inválida.');
    const next = structuredClone(this.data);
    const company = next.companies.find(c=>c.id===id);
    if (!company) throw new Error('Empresa não encontrada.');
    company.photo = photo;
    this.commit(next);
  }
}
export function companyTabs(store) {
  return `<section class="company-switcher" aria-label="Seleção da empresa"><div class="company-tabs" role="tablist" aria-label="Empresas">${store.companies.map(c=>`<button type="button" role="tab" aria-selected="${c.id===store.active.id}" aria-controls="company-content" data-company="${escapeHTML(c.id)}" title="${escapeHTML(c.name)}"><span class="company-tab-dot"></span>${escapeHTML(c.name)}</button>`).join('')}</div><button type="button" class="company-add" data-new-company>＋ Nova empresa</button><button type="button" class="company-edit" data-edit-company="${escapeHTML(store.active.id)}" aria-label="Editar empresa selecionada">Editar</button></section>`;
}
export function companiesPage(store) {
  return `<div class="company-page-heading"><div><h3>Empresas e conexões</h3><p>Cadastre cada empresa e escolha a aba que deseja consultar. Os cadastros ficam neste dispositivo.</p></div><button class="primary" data-new-company>＋ Nova empresa</button></div><div class="company-cards">${store.companies.map(c=>`<section class="panel company-card ${c.id===store.active.id?'current-company':''}"><div class="company-card-top"><span class="company-photo">${c.photo?`<img alt="Logo da empresa" src="${escapeHTML(c.photo)}">`:escapeHTML(c.name.slice(0,2).toUpperCase())}</span><div><h3>${escapeHTML(c.name)}</h3><p>${escapeHTML(c.document||'Identificação não informada')}</p></div>${c.id===store.active.id?'<span class="selected-company-label">Selecionada</span>':''}</div><p>${escapeHTML(c.legalName||'Razão social não informada')}</p><p>${escapeHTML([c.city,c.state].filter(Boolean).join(' / ')||'Localidade não informada')}</p><p><span class="status-dot"></span>Mithra não conectado${c.mithraId?' · '+escapeHTML(c.mithraId):''}</p><div class="company-card-actions"><button class="export" data-edit-company="${escapeHTML(c.id)}">Editar cadastro</button>${c.id!==store.active.id?`<button class="primary" data-company="${escapeHTML(c.id)}">Selecionar empresa</button>`:''}</div></section>`).join('')}</div>`;
}
export function companyDialog(store,onSave) {
  let dialog;
  const open = id => {
    dialog?.remove();
    const company = id ? store.companies.find(c=>c.id===id) : null;
    if (id && !company) return;
    const c = company || {};
    dialog=document.createElement('dialog');dialog.className='company-dialog';
    dialog.setAttribute('aria-labelledby','company-dialog-title');
    const input=(key,label,placeholder='',required=false)=>`<label>${label}<input name="${key}" maxlength="${fields[key]}" value="${escapeHTML(c[key])}" placeholder="${placeholder}" ${required?'required':''}></label>`;
    dialog.innerHTML=`<form id="company-form"><div class="company-dialog-header"><div><span class="eyebrow">SEU ESPAÇO DE TRABALHO</span><h2 id="company-dialog-title">${id?'Editar empresa':'Nova empresa'}</h2></div><button type="button" data-close-company aria-label="Fechar cadastro">×</button></div><p>Dê um nome para a aba e registre os dados que identificam esta empresa.</p><div class="company-form-fields">${input('name','Nome na aba *','Ex.: Loja Centro',true)}${input('legalName','Razão social','Ex.: Comércio de Alimentos Ltda.')}${input('document','CNPJ / identificação','Opcional')}${input('mithraId','Identificador no Mithra','Opcional · sem senha')}${input('city','Cidade','Opcional')}${input('state','UF','Ex.: BA')}<label class="full-width">Observações<textarea name="notes" maxlength="300" rows="2">${escapeHTML(c.notes)}</textarea></label></div><label class="demo-choice"><input type="checkbox" name="demoEnabled" ${c.demoEnabled?'checked':''}>Exibir dados fictícios para testar o painel</label><p class="company-form-note">O cadastro identifica a empresa. A conexão real ao Mithra será configurada posteriormente. Não informe senhas aqui.</p><p class="company-form-error" role="alert" hidden></p><div class="company-dialog-actions"><button type="button" class="export" data-close-company>Cancelar</button><button type="submit" class="primary">Salvar empresa</button></div></form>`;
    document.body.append(dialog);
    dialog.querySelectorAll('[data-close-company]').forEach(b=>b.onclick=()=>dialog.close());
    dialog.addEventListener('close',()=>dialog.remove());
    dialog.querySelector('form').addEventListener('submit',event=>{
      event.preventDefault();
      const data=Object.fromEntries(new FormData(event.currentTarget));data.demoEnabled=data.demoEnabled==='on';
      try {store.save(data,id);dialog.close();onSave();}
      catch(error){const box=dialog.querySelector('[role="alert"]');box.textContent=error.message;box.hidden=false;}
    });
    dialog.showModal();
  };
  return {open};
}
