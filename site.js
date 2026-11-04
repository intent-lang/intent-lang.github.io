// Colours the code on the topic pages like the editor does: keywords, types, calls,
// numbers, strings, comments and the system's @ names
(() => {
  const keywords = new Set(['module', 'struct', 'enum', 'fn', 'task', 'kernel', 'job', 'public', 'extern', 'return',
    'if', 'else', 'for', 'while', 'in', 'out', 'inout', 'over', 'dependency', 'true', 'false',
    'int', 'uint', 'long', 'ulong', 'float', 'double', 'bool', 'char', 'byte', 'string', 'ptr']);
  const token = /(\/\/[^\n]*)|("(?:[^"\\]|\\.)*")|(@\w+)|(\b\d+(?:\.\d+)?\b)|(\b[A-Za-z_]\w*\b)(\s*\()?/g;
  const escape = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const span = (kind, text) => `<span class="tok-${kind}">${escape(text)}</span>`;
  for (const pre of document.querySelectorAll('pre.code')) {
    const text = pre.textContent;
    let html = '', at = 0;
    for (const m of text.matchAll(token)) {
      html += escape(text.slice(at, m.index));
      const [all, comment, string, system, number, word, call] = m;
      if (comment) html += span('comment', comment);
      else if (string) html += span('string', string);
      else if (system) html += span('system', system);
      else if (number) html += span('number', number);
      else if (keywords.has(word)) html += span('keyword', word) + escape(call ?? '');
      else if (call) html += span('function', word) + escape(call);
      else if (/^[A-Z]/.test(word) && !/^[A-Z_]+$/.test(word)) html += span('type', word);
      else html += escape(word);
      at = m.index + all.length;
    }
    pre.innerHTML = html + escape(text.slice(at));
  }
})();
