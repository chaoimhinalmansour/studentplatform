'use strict';

const samples = window.studentPlatformSamples;
const views = ['source', 'thought', 'language', 'summary'];
const byId = id => document.getElementById(id);
const tabs = Array.from(document.querySelectorAll('[data-view]'));
const sourcePanel = byId('panel-source');
const figurePanel = byId('task-figures');
const chars = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'};
const escapeHtml = text => String(text).replace(/[&<>"']/g, char => chars[char]);
const noteFor = id => sample.issues.find(note => note.id === id);
let sample;
let selected;
let frame;
const resize = new ResizeObserver(scheduleNotes);

function showView(view) {
  for (const tab of tabs) {
    const active = tab.dataset.view === view;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    byId(`panel-${tab.dataset.view}`).hidden = !active;
  }
  if (view === 'source') scheduleNotes();
}

function reveal(node) {
  if (!node) return;
  node.scrollIntoView({block: 'nearest'});
  if (node.matches('button')) node.focus({preventScroll: true});
}

function drawFigures() {
  const figures = sample.figures || [];
  byId('material-title').textContent = figures.length ? '题目与图表' : '写作题目';
  byId('task-prompt').textContent = sample.prompt;
  figurePanel.innerHTML = figures.map((figure, index) => {
    const head = figure.years.map(year => `<th scope="col">${year}</th>`).join('');
    const rows = figure.series.map(series => `<tr><th scope="row">${escapeHtml(series.name)}</th>${series.values.map(value => `<td>${value}</td>`).join('')}</tr>`).join('');
    return `<figure id="figure-${index + 1}"><figcaption>${escapeHtml(figure.title)}</figcaption>${figure.svg}<details class="figure-values"><summary>查看数据表</summary><table><thead><tr><th scope="col">${escapeHtml(figure.unit)}</th>${head}</tr></thead><tbody>${rows}</tbody></table></details></figure>`;
  }).join('');
}

function pin(issue, paragraph = false) {
  const extra = paragraph ? ' paragraph-pin' : '';
  const anchor = paragraph ? ` data-anchor="${issue.id}"` : '';
  return `<button type="button" class="pin${extra}" data-note="${issue.id}"${anchor} aria-pressed="false" aria-controls="note-${issue.id}" aria-label="${paragraph ? '段评' : '批注'}${issue.id}">${issue.id}</button>`;
}

function drawParagraph(text, index) {
  const notes = sample.issues.filter(issue => issue.paragraph === index + 1);
  const pins = notes.filter(issue => issue.scope === 'paragraph').map(issue => pin(issue, true)).join('');
  const phrases = notes.filter(issue => issue.scope === 'phrase').sort((a, b) => a.start - b.start);
  let cursor = 0;
  let marked = pins;
  for (const issue of phrases) {
    const end = issue.start + issue.quote.length;
    marked += escapeHtml(text.slice(cursor, issue.start));
    marked += `<span class="phrase" data-anchor="${issue.id}">${escapeHtml(text.slice(issue.start, end))}</span>${pin(issue)}`;
    cursor = end;
  }
  return `<p class="paragraph" id="paragraph-${index + 1}" lang="en">${marked}${escapeHtml(text.slice(cursor))}</p>`;
}

function drawSource() {
  const notes = sample.issues.map(issue => {
    const caption = issue.track === 'thought' ? '看思维复盘' : '看表达讲评';
    return `<article class="margin-note" data-note-card="${issue.id}" id="note-${issue.id}"><button class="note-body" type="button" data-note="${issue.id}" aria-pressed="false" aria-controls="paragraph-${issue.paragraph}"><span class="number">${issue.id}</span><span><strong>${escapeHtml(issue.label)}</strong><span>${escapeHtml(issue.text)}</span></span></button><button class="text-button note-more" type="button" data-lesson="${issue.id}">${caption}</button></article>`;
  }).join('');
  const grades = sample.assessment.criteria.map(item => `<div class="criterion"><dt>${item.code} · ${item.score}</dt><dd>${escapeHtml(item.text)}</dd></div>`).join('');
  sourcePanel.innerHTML = `<div class="reading"><article class="paper"><header class="paper-top"><h3>学生原文</h3><span>${sample.wordCount} 词</span></header>${sample.paragraphs.map(drawParagraph).join('')}</article><aside aria-label="页边批注"><header class="margin-top"><h3>页边批注</h3><span>${sample.issues.length} 处</span></header><div class="notes">${notes}</div></aside></div><section class="assessment"><header class="assessment-title"><h3>四项评价</h3><p>原文 ${sample.wordCount} 词 · 达到 ${sample.minimum} 词要求 · 示例预估 ${sample.assessment.band}</p></header><dl>${grades}</dl></section>`;
  resize.disconnect();
  resize.observe(sourcePanel.querySelector('.paper'));
}

function alignNotes() {
  const reading = sourcePanel.querySelector('.reading');
  if (!reading || sourcePanel.hidden) return;
  const column = reading.querySelector('.notes');
  const wide = matchMedia('(min-width: 801px)').matches;
  reading.classList.toggle('aligned', wide);
  if (!wide) {
    column.style.minHeight = '';
    return;
  }
  const origin = column.getBoundingClientRect().top;
  let bottom = 0;
  for (const issue of sample.issues) {
    const card = byId(`note-${issue.id}`);
    const anchor = reading.querySelector(`[data-anchor="${issue.id}"]`);
    const top = Math.max(bottom, anchor.getClientRects()[0].top - origin - 4);
    card.style.setProperty('--note-top', `${Math.round(top)}px`);
    bottom = top + card.offsetHeight + 7;
  }
  column.style.minHeight = `${Math.ceil(bottom - 7)}px`;
}

function scheduleNotes() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(alignNotes);
}

function selectIssue(id) {
  selected = id;
  for (const control of sourcePanel.querySelectorAll('[data-note]')) control.setAttribute('aria-pressed', String(control.dataset.note === id));
  for (const card of sourcePanel.querySelectorAll('[data-note-card]')) card.classList.toggle('is-selected', card.dataset.noteCard === id);
  for (const anchor of sourcePanel.querySelectorAll('.phrase')) anchor.classList.toggle('is-selected', anchor.dataset.anchor === id);
  byId('review-status').textContent = `已选中批注${id}，${noteFor(id).label}`;
  scheduleNotes();
}

function drawThought() {
  const outline = sample.outline ? `<details class="outline" open><summary>样稿的原始中文提纲</summary><ul>${sample.outline.map(row => `<li><strong>${escapeHtml(row.title)}</strong>　${escapeHtml(row.text)}</li>`).join('')}</ul></details>` : '';
  const chains = sample.chains.map((chain, i) => {
    const steps = chain.steps.map((step, j) => {
      const gap = /缺|跳步|待核对/.test(step.label);
      return `<li><button class="node${gap ? ' gap' : ''}" type="button" data-step="${i}-${j}" aria-controls="chain-detail-${i}" aria-pressed="false"><span>${escapeHtml(step.label)}</span><strong>${escapeHtml(step.text)}</strong></button></li>`;
    }).join('');
    return `<section class="chain"><h3>${escapeHtml(chain.title)}</h3><ol class="steps">${steps}</ol><div class="chain-detail" id="chain-detail-${i}" aria-live="polite"></div><p class="practice"><strong>留给你的练习</strong>　${escapeHtml(chain.prompt)}</p></section>`;
  }).join('');
  byId('panel-thought').innerHTML = `<p class="section-intro">${sample.outline ? '沿原提纲和成稿逐步对照。点节点，查看这一步的依据。' : '把图表里的事实与原文中的判断对照。点节点，查看证据支持到哪一步。'}</p>${outline}${chains}`;
  sample.chains.forEach((_, index) => selectStep(index, 0));
}

function selectStep(chainIndex, stepIndex) {
  const step = sample.chains[chainIndex].steps[stepIndex];
  const detail = byId(`chain-detail-${chainIndex}`);
  for (const button of detail.parentElement.querySelectorAll('[data-step]')) button.setAttribute('aria-pressed', String(button.dataset.step === `${chainIndex}-${stepIndex}`));
  const issue = step.issue && noteFor(step.issue);
  let evidence = '';
  if (step.outline !== undefined) {
    evidence = `<p class="quote">${escapeHtml(sample.outline[step.outline].text)}</p>`;
  } else if (step.quote || issue) {
    evidence = `<p class="quote" lang="en">${escapeHtml(step.quote || issue.quote)}</p>`;
  }
  let target = '';
  if (issue) target = `<button class="text-button" type="button" data-return="${issue.id}">回到原文批注 ${issue.id}</button>`;
  else if (step.paragraph) target = `<button class="text-button" type="button" data-paragraph="${step.paragraph}">看原文第 ${step.paragraph} 段</button>`;
  else if (step.source) target = `<button class="text-button" type="button" data-figure="${step.source.endsWith('1') ? '1' : '2'}">查看${escapeHtml(step.source)}</button>`;
  detail.innerHTML = `<p>${escapeHtml(step.detail)}</p>${evidence}${target}`;
}

function drawLessons() {
  const language = sample.issues.filter(issue => issue.track === 'language');
  byId('panel-language').innerHTML = `<p class="section-intro">每条讲评都对应一处原文批注。先看这句想表达什么，再记一个可以迁移的搭配。</p>${language.map(issue => `<section class="lesson" id="lesson-${issue.id}"><h3><span class="number">${issue.id}</span>　${escapeHtml(issue.label)}</h3><p class="quote" lang="en">${escapeHtml(issue.quote)}</p><p>${escapeHtml(issue.text)}</p><p class="example" lang="en">${escapeHtml(issue.example)}</p><p>${escapeHtml(issue.use)}</p><button class="text-button" type="button" data-return="${issue.id}">回到原文批注 ${issue.id}</button></section>`).join('')}`;
}

function drawSummary() {
  const items = (rows, type) => rows.map(row => `<li><strong>${escapeHtml(row.title || row.phrase)}</strong><p>${escapeHtml(row.text)}</p><button class="text-button" type="button" data-lesson="${row.issue}">${type}</button></li>`).join('');
  byId('panel-summary').innerHTML = `<div class="summary-grid"><section class="summary-box"><h3>下一稿练什么思维动作</h3><ul>${items(sample.thoughtSummary, '回看推导')}</ul></section><section class="summary-box"><h3>本次积累的表达</h3><ul>${items(sample.languageSummary, '回看讲评')}</ul></section></div>`;
}

function openLesson(id) {
  const issue = noteFor(id);
  showView(issue.track);
  if (issue.track === 'language') {
    reveal(byId(`lesson-${id}`));
  } else {
    const chainIndex = sample.chains.findIndex(chain => chain.steps.some(step => step.issue === id));
    const stepIndex = sample.chains[chainIndex].steps.findIndex(step => step.issue === id);
    selectStep(chainIndex, stepIndex);
    reveal(document.querySelector(`[data-step="${chainIndex}-${stepIndex}"]`));
  }
}

function openSample() {
  const id = location.hash.slice(1);
  sample = samples.find(item => item.id === id) || samples[0];
  for (const button of document.querySelectorAll('[data-sample]')) button.setAttribute('aria-pressed', String(button.dataset.sample === sample.id));
  byId('task-label').textContent = `${sample.label} · ${sample.type}`;
  byId('task-title').textContent = sample.title;
  drawFigures();
  drawSource();
  drawThought();
  drawLessons();
  drawSummary();
  showView('source');
  selectIssue(sample.initial);
}

document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  const data = button.dataset;
  if (data.sample) {
    if (sample.id !== data.sample) location.hash = data.sample;
  } else if (data.view) showView(data.view);
  else if (data.step) selectStep(...data.step.split('-').map(Number));
  else if (data.note) {
    selectIssue(data.note);
    const target = button.classList.contains('pin') ? byId(`note-${selected}`) : sourcePanel.querySelector(`[data-anchor="${selected}"]`);
    requestAnimationFrame(() => reveal(target));
  } else if (data.lesson) openLesson(data.lesson);
  else if (data.return) {
    showView('source');
    selectIssue(data.return);
    reveal(sourcePanel.querySelector(`.pin[data-note="${data.return}"]`));
  } else if (data.paragraph) {
    showView('source');
    reveal(byId(`paragraph-${data.paragraph}`));
  } else if (data.figure) {
    byId('task-material').open = true;
    reveal(byId(`figure-${data.figure}`));
  }
});

document.querySelector('.view-tabs').addEventListener('keydown', event => {
  const index = tabs.indexOf(event.target);
  const next = {ArrowLeft: (index + 3) % 4, ArrowRight: (index + 1) % 4, Home: 0, End: 3}[event.key];
  if (index < 0 || next === undefined) return;
  event.preventDefault();
  showView(views[next]);
  tabs[next].focus();
});
window.addEventListener('hashchange', openSample);
window.addEventListener('resize', scheduleNotes);
openSample();
