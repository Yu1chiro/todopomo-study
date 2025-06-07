class StatisticsTracker {
  constructor() {
    this.userUID = null;
    this.isFirebaseReady = false;
    this.stats = {
      totalTasks: 0,
      completedTasks: 0,
      totalMinutes: 0,
      streak: 0
    };
    this.init();
  }

  // Initialize the statistics tracker
  async init() {
    try {
      console.log('Initializing StatisticsTracker...');
      
      // Wait for Firebase Auth to be ready
      await this.waitForFirebaseAuth();
      
      // Get current user UID
      this.userUID = await this.getCurrentUserUID();
      console.log('User UID:', this.userUID);
      
      if (this.userUID) {
        // Load statistics data
        await this.loadStatistics();
      } else {
        console.log('No user logged in, using default empty stats');
      }
      
      this.updateStatsDisplay();
      
      console.log('StatisticsTracker initialized successfully');
    } catch (error) {
      console.error('Error initializing statistics tracker:', error);
    }
  }

  // Wait for Firebase Auth to be ready
  waitForFirebaseAuth() {
    return new Promise((resolve) => {
      if (typeof firebase !== 'undefined' && firebase.auth) {
        const unsubscribe = firebase.auth().onAuthStateChanged(() => {
          unsubscribe();
          this.isFirebaseReady = true;
          resolve();
        });
      } else {
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
        resolve(user ? user.uid : null);
      } else {
        resolve('demo_user_' + Date.now());
      }
    });
  }

  // Load statistics data from Firebase
  async loadStatistics() {
    if (!this.userUID) {
      console.warn('No user UID available for loading statistics');
      return;
    }

    try {
      console.log('Loading statistics for user:', this.userUID);
      
      if (this.isFirebaseReady && firebase.database) {
        // Load todos data
        const todosSnapshot = await firebase.database()
          .ref(`users/${this.userUID}/todos`)
          .once('value');
        
        const todosData = todosSnapshot.val();
        if (todosData) {
          const todosArray = Object.values(todosData);
          this.stats.totalTasks = todosArray.length;
          this.stats.completedTasks = todosArray.filter(todo => todo.completed).length;
          this.stats.totalMinutes = todosArray.reduce((total, todo) => total + (todo.studyTime || 0), 0);
        }

        // Load progress data for streak calculation
        const progressSnapshot = await firebase.database()
          .ref(`users/${this.userUID}/progress`)
          .once('value');
        
        const progressData = progressSnapshot.val();
        if (progressData) {
          this.stats.streak = this.calculateStreak(Object.values(progressData));
        }
      } else {
        console.log('Firebase not available, using demo stats');
        this.stats = {
          totalTasks: 12,
          completedTasks: 7,
          totalMinutes: 345,
          streak: 3
        };
      }
      
      console.log('Loaded statistics:', this.stats);
    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  }

  // Calculate current streak based on progress data
  calculateStreak(progressData) {
    if (!progressData || progressData.length === 0) return 0;
    
    // Sort by date (newest first)
    progressData.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Convert dates to Date objects
    const dates = progressData
      .filter(p => p.studyTime > 0) // Only days with study time count for streak
      .map(p => new Date(p.date));
    
    if (dates.length === 0) return 0;
    
    let streak = 0;
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Check if today or yesterday was a study day to start the streak
    const lastDate = new Date(dates[0]);
    const diffDays = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      // Studied today
      streak = 1;
      // Check previous days
      for (let i = 1; i < dates.length; i++) {
        const prevDate = new Date(dates[i]);
        const dayDiff = Math.floor((lastDate - prevDate) / (1000 * 60 * 60 * 24));
        
        if (dayDiff === 1) {
          streak++;
          lastDate.setDate(lastDate.getDate() - 1);
        } else if (dayDiff > 1) {
          break; // Streak broken
        }
      }
    } else if (diffDays === 1) {
      // Studied yesterday but not today
      streak = 1;
      // Check previous days
      for (let i = 1; i < dates.length; i++) {
        const prevDate = new Date(dates[i]);
        const dayDiff = Math.floor((yesterday - prevDate) / (1000 * 60 * 60 * 24));
        
        if (dayDiff === 0) {
          streak++;
          yesterday.setDate(yesterday.getDate() - 1);
        } else if (dayDiff > 0) {
          break; // Streak broken
        }
      }
    }
    
    return streak;
  }

  // Update the stats display
  updateStatsDisplay() {
    document.getElementById('totalTasks').textContent = this.stats.totalTasks;
    document.getElementById('completedTasks').textContent = this.stats.completedTasks;
    document.getElementById('totalMinutes').textContent = this.stats.totalMinutes;
    document.getElementById('streak').textContent = this.stats.streak;
  }
}

// Initialize the statistics tracker when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.statisticsTracker = new StatisticsTracker();
});
