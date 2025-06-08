   class StudyTracker {
  constructor() {
    this.todos = [];
    this.currentUser = { name: 'Pengguna' };
    this.currentTodoId = null;
    this.editingTodoId = null;
    this.userUID = null;
    this.isFirebaseReady = false;
    this.timer = {
      minutes: 25,
      seconds: 0,
      isRunning: false,
      interval: null,
      currentTask: null,
      totalSeconds: 25 * 60,
      isSet: true
    };
    // TAMBAHKAN INI untuk break timer
  this.breakTimer = {
    minutes: 0,
    seconds: 0,
    isRunning: false,
    interval: null,
    totalSeconds: 0
  };
    this.progressData = [];
    this.audioElements = {
    rain: null,
    complete: null,
    break: null  // TAMBAHKAN INI yang hilang
  };
    this.focusMode = {
      active: false,
      overlay: null
    };
    this.init();
  }

  // Initialize Firebase and load user data
  async init() {
    try {
      console.log('Initializing StudyTracker...');
      
      // Initialize audio elements
      this.initializeAudio();
      
      // Wait for Firebase Auth to be ready
      await this.waitForFirebaseAuth();
      
      // Get current user UID
      this.userUID = await this.getCurrentUserUID();
      console.log('User UID:', this.userUID);
      
      if (this.userUID) {
        // Load data from Firebase
        await this.loadTodos();
        await this.loadProgressData();
        console.log('Data loaded successfully');
      } else {
        console.log('No user logged in, using default empty data');
        this.todos = [];
        this.progressData = this.getWeeklyProgress();
      }
      
      this.setupEventListeners();
      this.renderTodos();
      this.updateStats();
      this.updateTimerDisplay();
      this.updateTimerCircle();
      this.createFocusOverlay();
      
      console.log('StudyTracker initialized successfully');
    } catch (error) {
      console.error('Error initializing app:', error);
      this.showNotification('Gagal memuat data: ' + error.message, 'error');
    }
  }

  // Wait for Firebase Auth to be ready
  waitForFirebaseAuth() {
    return new Promise((resolve) => {
      if (typeof firebase !== 'undefined' && firebase.auth) {
        // Firebase is available, wait for auth state
        const unsubscribe = firebase.auth().onAuthStateChanged(() => {
          unsubscribe(); // Stop listening after first callback
          this.isFirebaseReady = true;
          resolve();
        });
      } else {
        // Firebase not available, continue with demo mode
        console.warn('Firebase not available, running in demo mode');
        this.isFirebaseReady = false;
        resolve();
      }
    });
  }

  // Get current user UID from Firebase Auth
  async getCurrentUserUID() {
    return new Promise((resolve) => {
      if (this.isFirebaseReady && firebase.auth) {
        const user = firebase.auth().currentUser;
        if (user) {
          console.log('User authenticated:', user.uid);
          resolve(user.uid);
        } else {
          console.log('No authenticated user');
          resolve(null);
        }
      } else {
        // Fallback untuk demo mode
        const demoUID = 'demo_user_' + Date.now();
        console.log('Using demo UID:', demoUID);
        resolve(demoUID);
      }
    });
  }

  // Load todos from Firebase Realtime Database
  async loadTodos() {
    if (!this.userUID) {
      console.warn('No user UID available for loading todos');
      this.todos = [];
      return;
    }

    try {
      console.log('Loading todos for user:', this.userUID);
      
      if (this.isFirebaseReady && firebase.database) {
        const snapshot = await firebase.database()
          .ref(`users/${this.userUID}/todos`)
          .once('value');
        
        const data = snapshot.val();
        console.log('Raw todos data from Firebase:', data);
        
        if (data && typeof data === 'object') {
          // Convert object to array, handling both old and new data structures
          this.todos = Object.values(data).map(todo => {
            // Ensure all required properties exist
            return {
              id: todo.id || Date.now(),
              title: todo.title || 'Untitled',
              category: todo.category || 'study',
              priority: todo.priority || 'medium',
              completed: Boolean(todo.completed),
              subtasks: Array.isArray(todo.subtasks) ? todo.subtasks : [],
              createdAt: todo.createdAt || new Date().toISOString(),
              studyTime: Number(todo.studyTime) || 0
            };
          });
        } else {
          this.todos = [];
        }
      } else {
        console.log('Firebase not available, using empty todos');
        this.todos = [];
      }
      
      // Sort todos by creation date (newest first)
      this.todos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      console.log('Loaded todos:', this.todos.length);
      return this.todos;
    } catch (error) {
      console.error('Error loading todos:', error);
      this.showNotification('Gagal memuat target: ' + error.message, 'error');
      this.todos = [];
      return [];
    }
  }

  // Save all todos to Firebase Realtime Database
  async saveTodos() {
    if (!this.userUID) {
      console.warn('No user UID available for saving todos');
      return false;
    }

    try {
      console.log('Saving todos for user:', this.userUID);
      
      if (this.isFirebaseReady && firebase.database) {
        // Convert array to object with todo IDs as keys
        const todosObject = {};
        this.todos.forEach(todo => {
          // Ensure data integrity before saving
          todosObject[todo.id] = {
            id: todo.id,
            title: todo.title,
            category: todo.category,
            priority: todo.priority,
            completed: Boolean(todo.completed),
            subtasks: Array.isArray(todo.subtasks) ? todo.subtasks : [],
            createdAt: todo.createdAt,
            studyTime: Number(todo.studyTime) || 0
          };
        });

        await firebase.database()
          .ref(`users/${this.userUID}/todos`)
          .set(todosObject);
        
        console.log('All todos saved successfully');
        return true;
      } else {
        console.log('Firebase not available, todos not saved');
        return false;
      }
    } catch (error) {
      console.error('Error saving todos:', error);
      this.showNotification('Gagal menyimpan data: ' + error.message, 'error');
      return false;
    }
  }

  // Save single todo (for real-time updates)
  async saveSingleTodo(todo) {
    if (!this.userUID || !todo) {
      console.warn('No user UID or todo available for saving');
      return false;
    }

    try {
      console.log('Saving single todo:', todo.id);
      
      if (this.isFirebaseReady && firebase.database) {
        // Ensure data integrity
        const todoData = {
          id: todo.id,
          title: todo.title,
          category: todo.category,
          priority: todo.priority,
          completed: Boolean(todo.completed),
          subtasks: Array.isArray(todo.subtasks) ? todo.subtasks : [],
          createdAt: todo.createdAt,
          studyTime: Number(todo.studyTime) || 0
        };

        await firebase.database()
          .ref(`users/${this.userUID}/todos/${todo.id}`)
          .set(todoData);
        
        console.log('Single todo saved successfully');
        return true;
      } else {
        console.log('Firebase not available, single todo not saved');
        return false;
      }
    } catch (error) {
      console.error('Error saving single todo:', error);
      this.showNotification('Gagal menyimpan target: ' + error.message, 'error');
      return false;
    }
  }

  // Delete single todo from Firebase
  async deleteSingleTodo(todoId) {
    if (!this.userUID || !todoId) {
      console.warn('No user UID or todo ID available for deleting');
      return false;
    }

    try {
      console.log('Deleting todo:', todoId);
      
      if (this.isFirebaseReady && firebase.database) {
        await firebase.database()
          .ref(`users/${this.userUID}/todos/${todoId}`)
          .remove();
        
        console.log('Todo deleted successfully');
        return true;
      } else {
        console.log('Firebase not available, todo not deleted from database');
        return false;
      }
    } catch (error) {
      console.error('Error deleting todo:', error);
      this.showNotification('Gagal menghapus target: ' + error.message, 'error');
      return false;
    }
  }

  // Load progress data from Firebase
  async loadProgressData() {
    if (!this.userUID) {
      console.warn('No user UID available for loading progress');
      this.progressData = this.getWeeklyProgress();
      return;
    }

    try {
      console.log('Loading progress data for user:', this.userUID);
      
      if (this.isFirebaseReady && firebase.database) {
        const snapshot = await firebase.database()
          .ref(`users/${this.userUID}/progress`)
          .once('value');
        
        const data = snapshot.val();
        console.log('Raw progress data from Firebase:', data);
        
        if (data && typeof data === 'object') {
          this.progressData = Object.values(data).map(progress => ({
            date: progress.date,
            studyTime: Number(progress.studyTime) || 0,
            completedTasks: Number(progress.completedTasks) || 0,
            sessions: Number(progress.sessions) || 0
          }));
        } else {
          this.progressData = this.getWeeklyProgress();
        }
      } else {
        this.progressData = this.getWeeklyProgress();
      }
      
      // Sort by date (newest first)
      this.progressData.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      console.log('Loaded progress data:', this.progressData.length);
    } catch (error) {
      console.error('Error loading progress data:', error);
      this.progressData = this.getWeeklyProgress();
    }
  }

  // Save progress data to Firebase
  async saveProgressData() {
    if (!this.userUID) {
      console.warn('No user UID available for saving progress');
      return false;
    }

    try {
      console.log('Saving progress data for user:', this.userUID);
      
      if (this.isFirebaseReady && firebase.database) {
        // Convert array to object with date strings as keys
        const progressObject = {};
        this.progressData.forEach(progress => {
          const dateKey = progress.date;
          progressObject[dateKey] = {
            date: progress.date,
            studyTime: Number(progress.studyTime) || 0,
            completedTasks: Number(progress.completedTasks) || 0,
            sessions: Number(progress.sessions) || 0
          };
        });

        await firebase.database()
          .ref(`users/${this.userUID}/progress`)
          .set(progressObject);
        
        console.log('Progress data saved successfully');
        return true;
      } else {
        console.log('Firebase not available, progress data not saved');
        return false;
      }
    } catch (error) {
      console.error('Error saving progress data:', error);
      this.showNotification('Gagal menyimpan data progress: ' + error.message, 'error');
      return false;
    }
  }

  // Initialize audio elements
 initializeAudio() {
  // Rain audio
  this.audioElements.rain = new Audio();
  this.audioElements.rain.loop = true;
  this.audioElements.rain.volume = 0.3;
  
  // Complete audio
  this.audioElements.complete = new Audio();
  this.audioElements.complete.volume = 0.5;
  
  // Break audio - PERBAIKAN: Tambahkan inisialisasi yang hilang
  this.audioElements.break = new Audio();
  this.audioElements.break.loop = true;
  this.audioElements.break.volume = 0.4;
  
  // Set audio sources if available
  try {
    this.audioElements.rain.src = '/audio/lofi.mp3';
    this.audioElements.complete.src = '/audio/yasumi.mp3';
    this.audioElements.break.src = '/audio/break.mp3';
  } catch (error) {
    console.warn('Audio files not found, continuing without audio');
  }
}
// Fungsi untuk membuat modal istirahat
createBreakModal() {
  const modal = document.createElement('div');
  modal.id = 'breakModal';
  modal.className = 'fixed inset-0 bg-gray-900 bg-opacity-60 backdrop-blur-sm z-50 hidden items-center justify-center transition-all duration-500 ease-in-out';
  modal.innerHTML = `
    <div class="bg-white rounded-3xl p-8 text-center shadow-2xl max-w-md mx-4">
      <div class="mb-6">
        <div class="text-6xl mb-4">☕</div>
        <h2 class="text-2xl font-bold text-gray-800 mb-2">Sesi Belajar Selesai!</h2>
        <p class="text-gray-600">Apakah Anda ingin istirahat sejenak?</p>
      </div>
      
      <div class="space-y-4 mb-6">
        <button onclick="studyTracker.startBreak(3)" 
                class="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-4 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 transform hover:scale-105 font-semibold shadow-lg">
          Istirahat 3 Menit ⏰
        </button>
        <button onclick="studyTracker.startBreak(5)" 
                class="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-4 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 transform hover:scale-105 font-semibold shadow-lg">
          Istirahat 5 Menit ⏰
        </button>
        <button onclick="studyTracker.startBreak(10)" 
                class="w-full bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-4 rounded-xl hover:from-green-600 hover:to-green-700 transition-all duration-200 transform hover:scale-105 font-semibold shadow-lg">
          Istirahat 10 Menit ⏰
        </button>
      </div>
      
      <button onclick="studyTracker.skipBreak()" 
              class="text-gray-500 hover:text-gray-700 underline text-sm transition-colors">
        Lewati Istirahat
      </button>
    </div>
  `;
  
  document.body.appendChild(modal);
  return modal;
}

// Fungsi untuk membuat modal break timer
createBreakTimerModal() {
  const modal = document.createElement('div');
  modal.id = 'breakTimerModal';
  modal.className = 'fixed inset-0 bg-green-900 bg-opacity-60 backdrop-blur-sm z-50 hidden items-center justify-center transition-all duration-500 ease-in-out';
  modal.innerHTML = `
    <div class="bg-white bg-opacity-95 backdrop-blur-md rounded-3xl p-8 text-center shadow-2xl">
      <div class="mb-6">
        <div class="text-4xl mb-4">🌿</div>
        <h2 class="text-2xl font-bold text-gray-800 mb-2">Waktu Istirahat</h2>
        <p class="text-gray-600">Nikmati waktu istirahat Anda</p>
      </div>
      
      <!-- Break Timer Circle -->
      <div class="relative w-48 h-48 mx-auto mb-6">
        <svg class="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="50" stroke="#10B981" stroke-width="2" fill="none" opacity="0.3"/>
          <circle cx="60" cy="60" r="50" stroke="#10B981" stroke-width="4" fill="none" 
                  stroke-linecap="round" id="breakTimerCircle"
                  style="stroke-dasharray: 314; stroke-dashoffset: 314; transition: stroke-dashoffset 1s ease-in-out;"/>
        </svg>
        <div class="absolute inset-0 flex items-center justify-center">
          <div class="text-center">
            <div class="text-4xl font-mono font-bold text-gray-800" id="breakTimerDisplay">05:00</div>
            <div class="text-sm text-gray-600 mt-1">Istirahat</div>
          </div>
        </div>
      </div>
      
      <!-- Control Button -->
      <div class="flex justify-center">
        <button onclick="studyTracker.endBreak()" 
                class="bg-red-500 bg-opacity-80 hover:bg-opacity-100 text-white px-8 py-3 rounded-full transition-all duration-200 font-semibold">
          Akhiri Istirahat
        </button>
      </div>
      
      <!-- Audio indicator -->
      <div class="mt-4 text-gray-500">
        <span class="text-sm">🎵 Musik relaksasi aktif</span>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  return modal;
}

  // Create focus mode overlay
  createFocusOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'focusOverlay';
    overlay.className = 'fixed inset-0 bg-gray-900 bg-opacity-60 backdrop-blur-sm z-50 hidden items-center justify-center transition-all duration-500 ease-in-out';
    overlay.innerHTML = `
      <div class="bg-gray bg-opacity-60 backdrop-blur-md rounded-3xl p-8 text-center text-white shadow-2xl">
        <div class="mb-6">
          <h2 class="text-2xl font-bold mb-2" id="focusTaskName">Sesi Belajar</h2>
          <p class="text-lg opacity-80">Mode Fokus Aktif</p>
        </div>
        
        <!-- Analog Timer Circle -->
        <div class="relative w-48 h-48 mx-auto mb-6">
          <svg class="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="50" stroke="white" stroke-width="2" fill="none" opacity="0.3"/>
            <circle cx="60" cy="60" r="50" stroke="white" stroke-width="4" fill="none" 
                    stroke-linecap="round" id="focusTimerCircle"
                    style="stroke-dasharray: 314; stroke-dashoffset: 314; transition: stroke-dashoffset 1s ease-in-out;"/>
          </svg>
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="text-center">
              <div class="text-4xl font-mono font-bold" id="focusTimerDisplay">25:00</div>
              <div class="text-sm opacity-70 mt-1" id="focusTimerStatus">Sedang Berjalan</div>
            </div>
          </div>
        </div>
        
        <!-- Control Buttons -->
        <div class="flex justify-center space-x-4">
          <button onclick="studyTracker.toggleTimer()" 
                  class="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-8 py-3 rounded-full transition-all duration-200 backdrop-blur-sm font-semibold">
            <span id="focusStartPauseText">Pause</span>
          </button>
          <button onclick="studyTracker.exitFocusMode()" 
                  class="bg-red-500 bg-opacity-80 hover:bg-opacity-100 text-white px-8 py-3 rounded-full transition-all duration-200 font-semibold">
            Keluar
          </button>
        </div>
        
        <!-- Audio indicator -->
        <div class="mt-4 opacity-60">
          <span class="text-sm">Mode fokus active</span>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    this.focusMode.overlay = overlay;
  }

setupEventListeners() {
  // Todo form
  document.getElementById('addTodoBtn').addEventListener('click', () => this.addTodo());
  document.getElementById('todoTitle').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') this.addTodo();
  });

  // Timer controls - HAPUS startPauseBtn, hanya reset
  document.getElementById('resetBtn').addEventListener('click', () => this.resetTimer());
  
  // Timer presets
  document.querySelectorAll('.timer-preset').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const minutes = parseInt(e.target.dataset.minutes);
      this.setTimerMinutes(minutes);
    });
  });

  document.getElementById('customMinutes').addEventListener('change', (e) => {
    this.setTimerMinutes(parseInt(e.target.value) || 25);
  });

  // Subtask modal
  document.getElementById('cancelSubtask').addEventListener('click', () => this.hideSubtaskModal());
  document.getElementById('addSubtask').addEventListener('click', () => this.addSubtask());
  document.getElementById('subtaskTitle').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') this.addSubtask();
  });

  // Edit todo modal
  document.getElementById('cancelEditTodo').addEventListener('click', () => this.hideEditTodoModal());
  document.getElementById('saveEditTodo').addEventListener('click', () => this.saveEditTodo());

  // Sign out
  document.getElementById('signOutButton').addEventListener('click', async () =>{
     if (confirm('Apakah Anda yakin ingin keluar?')) {
    try {
      // Simpan data sebelum logout
      console.log('Saving data before sign out...');
      // Logout dari Firebase
      if (typeof firebase !== 'undefined' && firebase.auth) {
        await firebase.auth().signOut();
        console.log('Firebase sign out successful');
      }

      // Panggil sessionLogout di server
      await fetch('/sessionLogout', { credentials: 'same-origin' });
      console.log('Session logout successful');

      // Redirect ke halaman login
      window.location.href = '/';
    } catch (error) {
      console.error('Error during sign out:', error);
      showNotification('Gagal keluar: ' + error.message, 'error');
    }
  }
  });
}

  async addTodo() {
    const title = document.getElementById('todoTitle').value.trim();
    const category = document.getElementById('todoCategory').value;
    const priority = document.getElementById('todoPriority').value;

    if (!title) {
      this.showNotification('Judul target tidak boleh kosong!', 'error');
      return;
    }

    const todo = {
      id: Date.now(),
      title,
      category,
      priority,
      completed: false,
      subtasks: [],
      createdAt: new Date().toISOString(),
      studyTime: 0
    };

    // Add to local array
    this.todos.unshift(todo);
    
    // Save to Firebase immediately
    const saved = await this.saveSingleTodo(todo);
    
    if (saved || !this.isFirebaseReady) {
      this.clearTodoForm();
      this.renderTodos();
      this.updateStats();
      this.showNotification('Target berhasil ditambahkan!', 'success');
    } else {
      // Remove from local array if save failed
      this.todos = this.todos.filter(t => t.id !== todo.id);
      this.showNotification('Gagal menyimpan target', 'error');
    }
  }

  clearTodoForm() {
    document.getElementById('todoTitle').value = '';
    document.getElementById('todoCategory').value = 'study';
    document.getElementById('todoPriority').value = 'high';
  }

  renderTodos() {
    const todoList = document.getElementById('todoList');
    if (this.todos.length === 0) {
      todoList.innerHTML = `
        <div class="text-center py-8 text-gray-500">
          <div class="text-4xl mb-2">📝</div>
          <p>Belum ada target yang dibuat</p>
          <p class="text-sm">Mulai dengan membuat target pertama Anda!</p>
        </div>
      `;
      return;
    }

    todoList.innerHTML = this.todos.map(todo => this.renderTodoItem(todo)).join('');
  }

  renderTodoItem(todo) {
    const priorityColors = {
      high: 'bg-red-100 text-red-700 border-red-200',
      medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      low: 'bg-green-100 text-green-700 border-green-200'
    };

    const categoryIcons = {
      study: '📚',
      language: '🗣️',
      skill: '🛠️',
      other: '📋'
    };

    const priorityText = {
      high: 'Tinggi',
      medium: 'Sedang',
      low: 'Rendah'
    };

    return `
      <div class="border border-gray-200 rounded-lg p-3 sm:p-4 ${todo.completed ? 'bg-gray-50' : 'bg-white'} hover:shadow-md transition-shadow">
        <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div class="flex-1">
            <div class="flex items-start space-x-2 sm:space-x-3 mb-2">
              <input type="checkbox" ${todo.completed ? 'checked' : ''} 
                     onchange="studyTracker.toggleTodo(${todo.id})"
                     class="mt-1 w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500">
              <div class="flex-1">
                <h3 class="font-medium text-gray-900 ${todo.completed ? 'line-through' : ''} text-sm sm:text-base">${todo.title}</h3>
                <div class="flex flex-wrap items-center gap-2 mt-1 sm:mt-2">
                  <span class="px-2 py-1 text-xs font-medium rounded-full border ${priorityColors[todo.priority]}">
                    ${priorityText[todo.priority]}
                  </span>
                  <span class="text-xs text-gray-500">${this.formatStudyTime(todo.studyTime)}</span>
                  <span class="text-sm sm:text-base">${categoryIcons[todo.category]}</span>
                </div>
              </div>
            </div>
            
            ${todo.subtasks.length > 0 ? `
              <div class="space-y-1 mb-2 sm:mb-3 ml-6 sm:ml-7">
                ${todo.subtasks.map(subtask => `
                  <div class="flex items-center space-x-2 text-xs sm:text-sm">
                    <input type="checkbox" ${subtask.completed ? 'checked' : ''} 
                           onchange="studyTracker.toggleSubtask(${todo.id}, ${subtask.id})"
                           class="w-3 h-3 text-indigo-600 rounded">
                    <span class="${subtask.completed ? 'line-through text-gray-500' : 'text-gray-700'}">${subtask.title}</span>
                  </div>
                `).join('')}
              </div>
            ` : ''}

            <div class="mt-3 mb-2">
              <button onclick="studyTracker.startStudySession(${todo.id})" 
                      class="w-full sm:w-auto bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all duration-200 transform hover:scale-[1.02] active:scale-95 font-semibold shadow-lg flex items-center justify-center space-x-2">
                <span>Mulai Belajar</span>
              </button>
            </div>
          </div>
          
          <div class="flex items-center justify-end sm:justify-start space-x-1 sm:space-x-2">
            <button onclick="studyTracker.showSubtaskModal(${todo.id})" 
                    class="p-1 sm:p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors text-sm sm:text-base"
                    title="Tambah Sub-target">
              Add Subtask
            </button>
            <button onclick="studyTracker.showEditTodoModal(${todo.id})" 
                    class="p-1 sm:p-2 text-amber-600 hover:bg-amber-50 rounded-full transition-colors text-sm sm:text-base"
                    title="Edit">
              Edit
            </button>
            <button onclick="studyTracker.deleteTodo(${todo.id})" 
                    class="p-1 sm:p-2 text-red-600 hover:bg-red-50 rounded-full transition-colors text-sm sm:text-base"
                    title="Hapus">
              Delete
            </button>
          </div>
        </div>
      </div>
    `;
  }

  async toggleTodo(id) {
    const todo = this.todos.find(t => t.id === id);
    if (todo) {
      todo.completed = !todo.completed;
      
      // Save to Firebase immediately
      const saved = await this.saveSingleTodo(todo);
      
      if (saved || !this.isFirebaseReady) {
        if (todo.completed) {
          this.showNotification('Target selesai! 🎉', 'success');
        }
        this.renderTodos();
        this.updateStats();
      } else {
        // Revert local change if save failed
        todo.completed = !todo.completed;
        this.showNotification('Gagal menyimpan perubahan', 'error');
      }
    }
  }

  async deleteTodo(id) {
    if (confirm('Apakah Anda yakin ingin menghapus target ini?')) {
      // Remove from local array
      const originalTodos = [...this.todos];
      this.todos = this.todos.filter(t => t.id !== id);
      
      // Delete from Firebase
      const deleted = await this.deleteSingleTodo(id);
      
      if (deleted || !this.isFirebaseReady) {
        this.renderTodos();
        this.updateStats();
        this.showNotification('Target berhasil dihapus', 'info');
      } else {
        // Restore local array if delete failed
        this.todos = originalTodos;
        this.showNotification('Gagal menghapus target', 'error');
      }
    }
  }

  showEditTodoModal(todoId) {
    const todo = this.todos.find(t => t.id === todoId);
    if (!todo) return;

    this.editingTodoId = todoId;
    document.getElementById('editTodoTitle').value = todo.title;
    document.getElementById('editTodoCategory').value = todo.category;
    document.getElementById('editTodoPriority').value = todo.priority;
    
    document.getElementById('editTodoModal').classList.remove('hidden');
    document.getElementById('editTodoModal').classList.add('flex');
    document.getElementById('editTodoTitle').focus();
  }

  hideEditTodoModal() {
    document.getElementById('editTodoModal').classList.add('hidden');
    document.getElementById('editTodoModal').classList.remove('flex');
    this.editingTodoId = null;
  }

  async saveEditTodo() {
    const title = document.getElementById('editTodoTitle').value.trim();
    const category = document.getElementById('editTodoCategory').value;
    const priority = document.getElementById('editTodoPriority').value;

    if (!title) {
      this.showNotification('Judul target tidak boleh kosong!', 'error');
      return;
    }

    const todo = this.todos.find(t => t.id === this.editingTodoId);
    if (todo) {
      // Store original values
      const originalTitle = todo.title;
      const originalCategory = todo.category;
      const originalPriority = todo.priority;
      
      // Update local values
      todo.title = title;
      todo.category = category;
      todo.priority = priority;
      
      // Save to Firebase
      const saved = await this.saveSingleTodo(todo);
      
      if (saved || !this.isFirebaseReady) {
        this.renderTodos();
        this.hideEditTodoModal();
        this.showNotification('Target berhasil diperbarui!', 'success');
      } else {
        // Revert local changes if save failed
        todo.title = originalTitle;
        todo.category = originalCategory;
        todo.priority = originalPriority;
        this.showNotification('Gagal menyimpan perubahan', 'error');
      }
    }
  }

  showSubtaskModal(todoId) {
    this.currentTodoId = todoId;
    document.getElementById('subtaskModal').classList.remove('hidden');
    document.getElementById('subtaskModal').classList.add('flex');
    document.getElementById('subtaskTitle').focus();
  }

  hideSubtaskModal() {
    document.getElementById('subtaskModal').classList.add('hidden');
    document.getElementById('subtaskModal').classList.remove('flex');
    document.getElementById('subtaskTitle').value = '';
    this.currentTodoId = null;
  }

  async addSubtask() {
    const title = document.getElementById('subtaskTitle').value.trim();
    if (!title) {
      this.showNotification('Judul sub-target tidak boleh kosong!', 'error');
      return;
    }

    const todo = this.todos.find(t => t.id === this.currentTodoId);
    if (todo) {
      const subtask = {
        id: Date.now(),
        title,
        completed: false,
        createdAt: new Date().toISOString()
      };
      
      // Add to local array
      todo.subtasks.push(subtask);
      
      // Save to Firebase
      const saved = await this.saveSingleTodo(todo);
      
      if (saved || !this.isFirebaseReady) {
        this.renderTodos();
        this.hideSubtaskModal();
        this.showNotification('Sub-target berhasil ditambahkan!', 'success');
      } else {
        // Remove from local array if save failed
        todo.subtasks = todo.subtasks.filter(s => s.id !== subtask.id);
        this.showNotification('Gagal menyimpan sub-target', 'error');
          }
    }
  }
   async toggleSubtask(todoId, subtaskId) {
    const todo = this.todos.find(t => t.id === todoId);
    if (todo) {
      const subtask = todo.subtasks.find(s => s.id === subtaskId);
      if (subtask) {
        subtask.completed = !subtask.completed;
        
        // Save to Firebase
        const saved = await this.saveSingleTodo(todo);
        
        if (saved || !this.isFirebaseReady) {
          this.renderTodos();
          this.updateStats();
        } else {
          // Revert local change if save failed
          subtask.completed = !subtask.completed;
          this.showNotification('Gagal menyimpan perubahan', 'error');
        }
      }
    }
  }

startStudySession(todoId) {
  const todo = this.todos.find(t => t.id === todoId);
  if (!todo) return;

  if (this.timer.isRunning) {
    if (confirm('Timer sedang berjalan. Apakah Anda ingin menghentikan sesi sebelumnya dan memulai yang baru?')) {
      this.resetTimer();
    } else {
      return;
    }
  }

  this.timer.currentTask = todo;
  this.showNotification(`Memulai sesi belajar: ${todo.title}`, 'info');
  
  // Update display
  this.updateTimerDisplay();
  this.updateTimerCircle();
  
  // Enter focus mode dan langsung start timer
  this.enterFocusMode();
  this.startTimer();
}

// Perbaikan method exitFocusMode - otomatis hentikan timer
exitFocusMode() {
  this.focusMode.active = false;
  
  // Hide overlay
  this.focusMode.overlay.classList.add('hidden');
  this.focusMode.overlay.classList.remove('flex');
  
  // Stop ambient sound
  if (this.audioElements.rain) {
    this.audioElements.rain.pause();
  }
  
  // OTOMATIS HENTIKAN TIMER ketika keluar focus mode
  if (this.timer.isRunning) {
    this.pauseTimer();
  }
}

// Perbaikan method enterFocusMode - hapus auto-start timer
enterFocusMode() {
  this.focusMode.active = true;
  
  // Update focus overlay content
  const taskName = this.timer.currentTask ? this.timer.currentTask.title : 'Sesi Belajar';
  document.getElementById('focusTaskName').textContent = taskName;
  document.getElementById('focusTimerDisplay').textContent = this.formatTime(this.timer.minutes, this.timer.seconds);
  
  // Show overlay
  this.focusMode.overlay.classList.remove('hidden');
  this.focusMode.overlay.classList.add('flex');
  
  // Start ambient sound
  if (this.audioElements.rain) {
    this.audioElements.rain.play().catch(console.warn);
  }
  
  // HAPUS auto-start timer - akan dihandle di startStudySession
}
startTimer() {
  if (this.timer.isRunning) return;

  this.timer.isRunning = true;
  this.timer.interval = setInterval(() => {
    this.updateTimer();
  }, 1000);

  // HAPUS update button startPauseBtn - tidak digunakan lagi
  
  if (this.focusMode.active) {
    document.getElementById('focusStartPauseText').textContent = 'Pause';
    document.getElementById('focusTimerStatus').textContent = 'Sedang Berjalan';
  }
}

// Perbaikan method pauseTimer - hapus update button startPauseBtn
pauseTimer() {
  if (!this.timer.isRunning) return;

  this.timer.isRunning = false;
  clearInterval(this.timer.interval);

  // HAPUS update button startPauseBtn - tidak digunakan lagi
  
  if (this.focusMode.active) {
    document.getElementById('focusStartPauseText').textContent = 'Start';
    document.getElementById('focusTimerStatus').textContent = 'Dijeda';
  }
}

// Method toggleTimer tetap ada untuk digunakan di focus mode
toggleTimer() {
  if (this.timer.isRunning) {
    this.pauseTimer();
  } else {
    this.startTimer();
  }
}
  resetTimer() {
    this.pauseTimer();
    this.timer.minutes = 25;
    this.timer.seconds = 0;
    this.timer.totalSeconds = 25 * 60;
    this.timer.currentTask = null;
    this.timer.isSet = true;

    this.updateTimerDisplay();
    this.updateTimerCircle();
    
    if (this.focusMode.active) {
      this.exitFocusMode();
    }
  }

  updateTimer() {
    if (this.timer.seconds === 0) {
      if (this.timer.minutes === 0) {
        // Timer completed
        this.timerComplete();
        return;
      }
      this.timer.minutes--;
      this.timer.seconds = 59;
    } else {
      this.timer.seconds--;
    }

    this.updateTimerDisplay();
    this.updateTimerCircle();
  }

  async timerComplete() {
  this.pauseTimer();
  
  // Play completion sound
  if (this.audioElements.complete) {
    this.audioElements.complete.play().catch(console.warn);
  }
  
  // Update task study time if there's a current task
  if (this.timer.currentTask) {
    const task = this.todos.find(t => t.id === this.timer.currentTask.id);
    if (task) {
      task.studyTime += this.timer.totalSeconds / 60; // Convert to minutes
      await this.saveSingleTodo(task);
    }
  }
  
  // Update progress data
  await this.updateTodayProgress();
  
  // Show completion notification
  this.showNotification('Sesi belajar selesai! 🎉', 'success');
  
  // Exit focus mode
  if (this.focusMode.active) {
    this.exitFocusMode();
  }
  
  // Reset timer
  this.resetTimer();
  
  // Refresh display
  this.renderTodos();
  this.updateStats();
  
  // TAMBAHKAN INI: Tampilkan modal istirahat
  this.showBreakModal();
}
showBreakModal() {
  // Create modal if not exists
  let modal = document.getElementById('breakModal');
  if (!modal) {
    modal = this.createBreakModal();
  }
  
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

// Fungsi untuk menyembunyikan modal istirahat
hideBreakModal() {
  const modal = document.getElementById('breakModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

// Fungsi untuk memulai istirahat
startBreak(minutes) {
  this.hideBreakModal();
  
  // Set break timer
  this.breakTimer.minutes = minutes;
  this.breakTimer.seconds = 0;
  this.breakTimer.totalSeconds = minutes * 60;
  this.breakTimer.isRunning = true;
  
  // Create and show break timer modal
  let breakTimerModal = document.getElementById('breakTimerModal');
  if (!breakTimerModal) {
    breakTimerModal = this.createBreakTimerModal();
  }
  
  // Update display and show modal
  this.updateBreakTimerDisplay();
  this.updateBreakTimerCircle();
  breakTimerModal.classList.remove('hidden');
  breakTimerModal.classList.add('flex');
  
  // PERBAIKAN: Start break audio dengan error handling dan logging
  console.log('Mencoba memainkan audio break...', this.audioElements.break);
  if (this.audioElements.break) {
    console.log('Audio break source:', this.audioElements.break.src);
    
    // Reset audio ke awal
    this.audioElements.break.currentTime = 0;
    
    // Coba play dengan promise handling
    const playPromise = this.audioElements.break.play();
    
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log('Audio break berhasil dimainkan');
        })
        .catch(error => {
          console.error('Gagal memainkan audio break:', error);
          // Coba alternatif: user interaction required
          this.showNotification('Klik untuk memulai audio istirahat 🎵', 'info');
        });
    }
  } else {
    console.error('Audio break element tidak tersedia');
  }
  
  // Start break timer interval
  this.breakTimer.interval = setInterval(() => {
    this.updateBreakTimer();
  }, 1000);
  
  this.showNotification(`Memulai istirahat ${minutes} menit 🌿`, 'info');
}

// PERBAIKAN 4: Tambahkan method untuk handle user interaction audio
enableBreakAudio() {
  if (this.audioElements.break && this.breakTimer.isRunning) {
    this.audioElements.break.play()
      .then(() => {
        console.log('Audio break berhasil dimainkan setelah user interaction');
      })
      .catch(error => {
        console.error('Masih gagal memainkan audio break:', error);
      });
  }
}

// Fungsi untuk update break timer
updateBreakTimer() {
  if (this.breakTimer.seconds === 0) {
    if (this.breakTimer.minutes === 0) {
      // Break timer completed
      this.breakComplete();
      return;
    }
    this.breakTimer.minutes--;
    this.breakTimer.seconds = 59;
  } else {
    this.breakTimer.seconds--;
  }

  this.updateBreakTimerDisplay();
  this.updateBreakTimerCircle();
}

// Fungsi untuk update display break timer
updateBreakTimerDisplay() {
  const display = this.formatTime(this.breakTimer.minutes, this.breakTimer.seconds);
  const displayElement = document.getElementById('breakTimerDisplay');
  if (displayElement) {
    displayElement.textContent = display;
  }
}

// Fungsi untuk update circle break timer
updateBreakTimerCircle() {
  const circle = document.getElementById('breakTimerCircle');
  if (circle) {
    const currentSeconds = this.breakTimer.minutes * 60 + this.breakTimer.seconds;
    const progress = currentSeconds / this.breakTimer.totalSeconds;
    const dashOffset = 314 * (1 - progress);
    circle.style.strokeDashoffset = dashOffset;
  }
}

// Fungsi ketika break selesai
// Fungsi ketika break selesai
breakComplete() {
  // Clear interval
  if (this.breakTimer.interval) {
    clearInterval(this.breakTimer.interval);
    this.breakTimer.interval = null;
  }
  
  this.breakTimer.isRunning = false;
  
  // Stop break audio
  if (this.audioElements.break) {
    this.audioElements.break.pause();
    this.audioElements.break.currentTime = 0;
  }
  
  // TAMBAHAN: Play yasumi.mp3 setelah istirahat berakhir
  if (this.audioElements.complete) {
    this.audioElements.complete.play().catch(console.warn);
  }
  
  // Hide break timer modal
  const breakTimerModal = document.getElementById('breakTimerModal');
  if (breakTimerModal) {
    breakTimerModal.classList.add('hidden');
    breakTimerModal.classList.remove('flex');
  }
  
  // Reset break timer
  this.breakTimer.minutes = 0;
  this.breakTimer.seconds = 0;
  this.breakTimer.totalSeconds = 0;
  
  this.showNotification('Waktu istirahat selesai! Siap untuk sesi berikutnya? 💪', 'success');
}
// Fungsi untuk melewati istirahat
skipBreak() {
  this.hideBreakModal();
  this.showNotification('Istirahat dilewati. Tetap semangat! 💪', 'info');
}

// Fungsi untuk mengakhiri istirahat lebih awal
endBreak() {
  if (confirm('Apakah Anda yakin ingin mengakhiri istirahat sekarang?')) {
    this.breakComplete();
  }
}
  setTimerMinutes(minutes) {
    if (this.timer.isRunning) {
      if (!confirm('Timer sedang berjalan. Apakah Anda ingin menghentikannya dan mengatur ulang?')) {
        return;
      }
      this.pauseTimer();
    }

    this.timer.minutes = minutes;
    this.timer.seconds = 0;
    this.timer.totalSeconds = minutes * 60;
    this.timer.isSet = true;

    this.updateTimerDisplay();
    this.updateTimerCircle();
  }

  updateTimerDisplay() {
    const display = this.formatTime(this.timer.minutes, this.timer.seconds);
    document.getElementById('timerDisplay').textContent = display;
    
    if (this.focusMode.active) {
      document.getElementById('focusTimerDisplay').textContent = display;
    }
  }

  updateTimerCircle() {
    const circle = document.getElementById('timerCircle');
    const focusCircle = document.getElementById('focusTimerCircle');
    
    const currentSeconds = this.timer.minutes * 60 + this.timer.seconds;
    const progress = currentSeconds / this.timer.totalSeconds;
    const dashOffset = 314 * (1 - progress);
    
    if (circle) {
      circle.style.strokeDashoffset = dashOffset;
    }
    
    if (focusCircle) {
      focusCircle.style.strokeDashoffset = dashOffset;
    }
  }

  formatTime(minutes, seconds) {
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  formatStudyTime(minutes) {
    if (minutes < 60) {
      return `${Math.round(minutes)}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  }

  async updateTodayProgress() {
    const today = new Date().toISOString().split('T')[0];
    let todayProgress = this.progressData.find(p => p.date === today);
    
    if (!todayProgress) {
      todayProgress = {
        date: today,
        studyTime: 0,
        completedTasks: 0,
        sessions: 0
      };
      this.progressData.unshift(todayProgress);
    }
    
    // Update sessions count
    todayProgress.sessions += 1;
    
    // Update study time (add timer duration in minutes)
    todayProgress.studyTime += this.timer.totalSeconds / 60;
    
    // Update completed tasks count
    todayProgress.completedTasks = this.todos.filter(t => t.completed).length;
    
    // Save to Firebase
    await this.saveProgressData();
  }

 updateStats() {
    const totalTodos = this.todos.length;
    const completedTodos = this.todos.filter(t => t.completed).length;
    const completionRate = totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0;
    
    // Calculate total study time
    const totalStudyTime = this.todos.reduce((total, todo) => total + (todo.studyTime || 0), 0);
    
    // Get today's progress
    const today = new Date().toISOString().split('T')[0];
    const todayProgress = this.progressData.find(p => p.date === today);
    const todayStudyTime = todayProgress ? todayProgress.studyTime : 0;
    const todaySessions = todayProgress ? todayProgress.sessions : 0;

    // Update DOM elements safely with null checks
    const totalTodosEl = document.getElementById('totalTodos');
    if (totalTodosEl) totalTodosEl.textContent = totalTodos;
    
    const completedTodosEl = document.getElementById('completedTodos');
    if (completedTodosEl) completedTodosEl.textContent = completedTodos;
    
    const completionRateEl = document.getElementById('completionRate');
    if (completionRateEl) completionRateEl.textContent = `${completionRate}%`;
    
    const totalStudyTimeEl = document.getElementById('totalStudyTime');
    if (totalStudyTimeEl) totalStudyTimeEl.textContent = this.formatStudyTime(totalStudyTime);
    
    const todayStudyTimeEl = document.getElementById('todayStudyTime');
    if (todayStudyTimeEl) todayStudyTimeEl.textContent = this.formatStudyTime(todayStudyTime);
    
    const todaySessionsEl = document.getElementById('todaySessions');
    if (todaySessionsEl) todaySessionsEl.textContent = todaySessions;
  }

  getWeeklyProgress() {
    const progress = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateString = date.toISOString().split('T')[0];
      
      progress.push({
        date: dateString,
        studyTime: 0,
        completedTasks: 0,
        sessions: 0
      });
    }
    
    return progress;
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 transition-all duration-300 transform translate-x-full`;
    
    const colors = {
      success: 'bg-green-500 text-white',
      error: 'bg-red-500 text-white',
      info: 'bg-blue-500 text-white',
      warning: 'bg-yellow-500 text-white'
    };
    
    notification.className += ` ${colors[type] || colors.info}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
      notification.classList.remove('translate-x-full');
    }, 10);
    
    // Auto remove
    setTimeout(() => {
      notification.classList.add('translate-x-full');
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.studyTracker = new StudyTracker();
});