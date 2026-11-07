(function () {
  'use strict';

  // ── GreetingManager ──────────────────────────────────────────────────────────
  const GreetingManager = {
    greetingEl: null,
    datetimeEl: null,

    getGreeting: function (hour) {
      if (hour >= 5 && hour <= 11) return 'Good Morning';
      if (hour >= 12 && hour <= 17) return 'Good Afternoon';
      if (hour >= 18 && hour <= 20) return 'Good Evening';
      return 'Good Night';
    },

    formatDatetime: function (date) {
      const dayName = date.toLocaleDateString('en-GB', { weekday: 'long' });
      const day   = date.getDate();
      const month = date.toLocaleDateString('en-GB', { month: 'long' });
      const year  = date.getFullYear();
      const hh = String(date.getHours()).padStart(2, '0');
      const mm = String(date.getMinutes()).padStart(2, '0');
      const ss = String(date.getSeconds()).padStart(2, '0');
      return dayName + ', ' + day + ' ' + month + ' ' + year + ', ' + hh + ':' + mm + ':' + ss;
    },

    update: function () {
      const now = new Date();
      this.greetingEl.textContent = this.getGreeting(now.getHours());
      this.datetimeEl.textContent = this.formatDatetime(now);
    },

    init: function () {
      this.greetingEl = document.getElementById('greeting-text');
      this.datetimeEl = document.getElementById('datetime');
      this.update();
      setInterval(this.update.bind(this), 1000);
    },
  };

  // ── TimerManager ─────────────────────────────────────────────────────────────
  const TimerManager = {
    secondsLeft: 1500,
    intervalId:  null,
    running:     false,
    displayEl:   null,
    startBtn:    null,
    stopBtn:     null,
    resetBtn:    null,

    formatTime: function (totalSeconds) {
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
    },

    render: function () {
      this.displayEl.textContent = this.formatTime(this.secondsLeft);
    },

    // REQ-7.1: simpan state timer ke LocalStorage
    _saveState: function () {
      try {
        localStorage.setItem('timerState', JSON.stringify({
          secondsLeft: this.secondsLeft,
          running: this.running,
        }));
      } catch (e) {
        console.warn('TimerManager: failed to save state', e);
      }
    },

    // REQ-7.1: muat state timer dari LocalStorage saat halaman dibuka
    _loadState: function () {
      try {
        var raw = localStorage.getItem('timerState');
        if (!raw) return;
        var state = JSON.parse(raw);
        if (typeof state.secondsLeft === 'number' && state.secondsLeft > 0) {
          this.secondsLeft = state.secondsLeft;
        }
      } catch (e) {
        console.warn('TimerManager: failed to load state', e);
      }
    },

    beep: function () {
      try {
        const ctx  = new (window.AudioContext || window.webkitAudioContext)();
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = 440;
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.5);
        osc.onended = function () { ctx.close(); };
      } catch (e) {
        console.warn('Web Audio API unavailable:', e);
      }
    },

    onComplete: function () {
      clearInterval(this.intervalId);
      this.intervalId  = null;
      this.running     = false;
      this.secondsLeft = 0;
      this.render();
      this._saveState();
      this.beep();
    },

    start: function () {
      if (this.running) return;
      this.running = true;
      this._saveState();
      this.intervalId = setInterval(function () {
        TimerManager.secondsLeft -= 1;
        TimerManager._saveState();
        if (TimerManager.secondsLeft <= 0) {
          TimerManager.onComplete();
        } else {
          TimerManager.render();
        }
      }, 1000);
    },

    stop: function () {
      if (!this.running) return;
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.running    = false;
      this._saveState();
    },

    reset: function () {
      this.stop();
      this.secondsLeft = 1500;
      this.render();
      this._saveState();
    },

    init: function () {
      this.displayEl = document.getElementById('timer-display');
      this.startBtn  = document.getElementById('timer-start');
      this.stopBtn   = document.getElementById('timer-stop');
      this.resetBtn  = document.getElementById('timer-reset');

      this._loadState(); // REQ-7.1: pulihkan sisa waktu dari LocalStorage
      this.render();

      this.startBtn.addEventListener('click', this.start.bind(this));
      this.stopBtn.addEventListener('click',  this.stop.bind(this));
      this.resetBtn.addEventListener('click', this.reset.bind(this));

      // REQ-7.2: peringatan saat meninggalkan halaman ketika timer berjalan
      window.addEventListener('beforeunload', function (e) {
        if (TimerManager.running) {
          e.preventDefault();
          e.returnValue = '';
        }
      });
    },
  };

  // ── TodoManager ──────────────────────────────────────────────────────────────
  const TodoManager = {
    tasks:   [],
    listEl:  null,
    inputEl: null,
    addBtn:  null,

    generateId: function () {
      return Date.now().toString(36) + Math.random().toString(36).slice(2);
    },

    loadTasks: function () {
      try {
        const raw = localStorage.getItem('todos');
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        console.warn('TodoManager: failed to load from LocalStorage', e);
        return [];
      }
    },

    saveTasks: function () {
      try {
        localStorage.setItem('todos', JSON.stringify(this.tasks));
      } catch (e) {
        console.warn('TodoManager: failed to save to LocalStorage', e);
      }
    },

    addTask: function (text) {
      const trimmed = text.trim();
      if (!trimmed) return; // REQ-3.7: abaikan input kosong/spasi
      this.tasks.push({ id: this.generateId(), text: trimmed, completed: false });
      this.saveTasks();
      this.render();
    },

    toggleComplete: function (id) {
      const task = this.tasks.find(function (t) { return t.id === id; });
      if (!task) return;
      task.completed = !task.completed;
      this.saveTasks();
      this.render();
    },

    editTask: function (id, newText) {
      const trimmed = newText.trim();
      if (!trimmed) return;
      const task = this.tasks.find(function (t) { return t.id === id; });
      if (!task) return;
      task.text = trimmed;
      this.saveTasks();
      this.render();
    },

    deleteTask: function (id) {
      this.tasks = this.tasks.filter(function (t) { return t.id !== id; });
      this.saveTasks();
      this.render();
    },

    render: function () {
      const sorted = this.tasks.slice().sort(function (a, b) {
        return (a.completed ? 1 : 0) - (b.completed ? 1 : 0);
      });
      this.listEl.innerHTML = '';
      sorted.forEach(function (task) {
        const li = document.createElement('li');
        li.dataset.id = task.id;
        if (task.completed) li.classList.add('completed');

        const checkbox = document.createElement('input');
        checkbox.type    = 'checkbox';
        checkbox.checked = task.completed;
        checkbox.setAttribute('aria-label', 'Mark task complete');
        checkbox.addEventListener('change', function () {
          TodoManager.toggleComplete(task.id);
        });

        const span = document.createElement('span');
        span.className   = 'todo-text';
        span.textContent = task.text;

        const editBtn = document.createElement('button');
        editBtn.type        = 'button';
        editBtn.className   = 'todo-edit';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', function () {
          TodoManager._startInlineEdit(li, task, span, editBtn);
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.type        = 'button';
        deleteBtn.className   = 'todo-delete';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', function () {
          TodoManager.deleteTask(task.id);
        });

        li.appendChild(checkbox);
        li.appendChild(span);
        li.appendChild(editBtn);
        li.appendChild(deleteBtn);
        TodoManager.listEl.appendChild(li);
      });
    },

    _startInlineEdit: function (li, task, span, editBtn) {
      if (li.querySelector('.todo-edit-input')) return;

      const input = document.createElement('input');
      input.type      = 'text';
      input.className = 'todo-edit-input';
      input.value     = task.text;

      const saveBtn = document.createElement('button');
      saveBtn.type        = 'button';
      saveBtn.className   = 'todo-save';
      saveBtn.textContent = 'Save';

      const commit = function () {
        const newText = input.value.trim();
        if (newText) TodoManager.editTask(task.id, newText);
      };

      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') commit(); });
      saveBtn.addEventListener('click', commit);

      li.replaceChild(input, span);
      li.replaceChild(saveBtn, editBtn);
      input.focus();
      input.select();
    },

    init: function () {
      this.listEl  = document.getElementById('todo-list');
      this.inputEl = document.getElementById('todo-input');
      this.addBtn  = document.getElementById('todo-add');

      this.addBtn.disabled = true;

      // REQ-3.7: disable tombol Add saat input kosong/spasi
      this.inputEl.addEventListener('input', function () {
        TodoManager.addBtn.disabled = TodoManager.inputEl.value.trim() === '';
      });

      this.addBtn.addEventListener('click', function () {
        TodoManager.addTask(TodoManager.inputEl.value);
        TodoManager.inputEl.value   = '';
        TodoManager.addBtn.disabled = true;
      });

      this.inputEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && TodoManager.inputEl.value.trim() !== '') {
          TodoManager.addTask(TodoManager.inputEl.value);
          TodoManager.inputEl.value   = '';
          TodoManager.addBtn.disabled = true;
        }
      });

      this.tasks = this.loadTasks();
      this.render();
    },
  };

  // ── LinksManager ─────────────────────────────────────────────────────────────
  const LinksManager = {
    links:       [],
    listEl:      null,
    nameInputEl: null,
    urlInputEl:  null,
    addBtn:      null,
    errorEl:     null,

    DEFAULT_LINKS: [
      { name: 'Google', url: 'https://google.com' },
      { name: 'GitHub', url: 'https://github.com' },
      { name: 'MDN',    url: 'https://developer.mozilla.org' },
    ],

    generateId: function () {
      return Date.now().toString(36) + Math.random().toString(36).slice(2);
    },

    // REQ-4.6: cek URL harus diawali http:// atau https://
    isValidUrl: function (url) {
      return /^https?:\/\/.+/.test(url.trim());
    },

    loadLinks: function () {
      try {
        const raw = localStorage.getItem('quicklinks');
        if (raw === null) {
          const defaults = this.DEFAULT_LINKS.map(function (link) {
            return { id: LinksManager.generateId(), name: link.name, url: link.url };
          });
          localStorage.setItem('quicklinks', JSON.stringify(defaults));
          return defaults;
        }
        return JSON.parse(raw);
      } catch (e) {
        console.warn('LinksManager: failed to load from LocalStorage', e);
        return [];
      }
    },

    saveLinks: function () {
      try {
        localStorage.setItem('quicklinks', JSON.stringify(this.links));
      } catch (e) {
        console.warn('LinksManager: failed to save to LocalStorage', e);
      }
    },

    addLink: function (name, url) {
      const trimmedName = name.trim();
      const trimmedUrl  = url.trim();
      if (!trimmedName || !trimmedUrl) return;

      // REQ-4.6: validasi format URL
      if (!this.isValidUrl(trimmedUrl)) {
        if (this.errorEl) {
          this.errorEl.textContent    = 'URL harus diawali dengan http:// atau https://';
          this.errorEl.style.display  = 'block';
        }
        return;
      }

      if (this.errorEl) this.errorEl.style.display = 'none';

      this.links.push({ id: this.generateId(), name: trimmedName, url: trimmedUrl });
      this.saveLinks();
      this.render();
    },

    deleteLink: function (id) {
      this.links = this.links.filter(function (l) { return l.id !== id; });
      this.saveLinks();
      this.render();
    },

    render: function () {
      this.listEl.innerHTML = '';
      this.links.forEach(function (link) {
        const item = document.createElement('div');
        item.className  = 'link-item';
        item.dataset.id = link.id;

        const anchor = document.createElement('a');
        anchor.href        = link.url;
        anchor.textContent = link.name;
        anchor.target      = '_blank';
        anchor.rel         = 'noopener noreferrer';

        const deleteBtn = document.createElement('button');
        deleteBtn.type        = 'button';
        deleteBtn.className   = 'link-delete';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', function () {
          LinksManager.deleteLink(link.id);
        });

        item.appendChild(anchor);
        item.appendChild(deleteBtn);
        LinksManager.listEl.appendChild(item);
      });
    },

    init: function () {
      this.listEl      = document.getElementById('links-list');
      this.nameInputEl = document.getElementById('link-name');
      this.urlInputEl  = document.getElementById('link-url');
      this.addBtn      = document.getElementById('link-add');
      this.errorEl     = document.getElementById('link-error');

      this.links = this.loadLinks();
      this.render();

      // Hapus pesan error saat user mulai mengetik URL baru
      this.urlInputEl.addEventListener('input', function () {
        if (LinksManager.errorEl) LinksManager.errorEl.style.display = 'none';
      });

      this.addBtn.addEventListener('click', function () {
        const before = LinksManager.links.length;
        LinksManager.addLink(LinksManager.nameInputEl.value, LinksManager.urlInputEl.value);
        if (LinksManager.links.length > before) {
          LinksManager.nameInputEl.value = '';
          LinksManager.urlInputEl.value  = '';
        }
      });

      [this.nameInputEl, this.urlInputEl].forEach(function (input) {
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') {
            const before = LinksManager.links.length;
            LinksManager.addLink(LinksManager.nameInputEl.value, LinksManager.urlInputEl.value);
            if (LinksManager.links.length > before) {
              LinksManager.nameInputEl.value = '';
              LinksManager.urlInputEl.value  = '';
            }
          }
        });
      });
    },
  };

  // ── Init ─────────────────────────────────────────────────────────────────────
  GreetingManager.init();
  TimerManager.init();
  TodoManager.init();
  LinksManager.init();
})();
