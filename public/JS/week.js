    class WeeklyStats {
      constructor() {
        this.userUID = null;
        this.isFirebaseReady = false;
        this.weeklyData = [];
        this.chart = null;
        this.init();
      }

      async init() {
        try {
          console.log('Initializing WeeklyStats...');
          await this.waitForFirebaseAuth();
          this.userUID = await this.getCurrentUserUID();
          
          if (this.userUID) {
            await this.loadWeeklyData();
          } else {
            console.log('No user logged in, using demo data');
            this.weeklyData = this.generateDemoData();
          }
          
          this.renderChart();
          this.setupResizeListener();
          
          console.log('WeeklyStats initialized successfully');
        } catch (error) {
          console.error('Error initializing weekly stats:', error);
        }
      }

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

      async loadWeeklyData() {
        if (!this.userUID) {
          console.warn('No user UID available for loading weekly data');
          this.weeklyData = this.generateDemoData();
          return;
        }

        try {
          console.log('Loading weekly data for user:', this.userUID);
          
          if (this.isFirebaseReady && firebase.database) {
            const snapshot = await firebase.database()
              .ref(`users/${this.userUID}/progress`)
              .once('value');
            
            const allData = snapshot.val() || {};
            
            // Get last 7 days data
            const dates = this.getLast7Days();
            this.weeklyData = dates.map(date => {
              const dayData = allData[date] || {
                date,
                studyTime: 0,
                completedTasks: 0,
                sessions: 0
              };
              return {
                date,
                studyTime: Number(dayData.studyTime) || 0,
                completedTasks: Number(dayData.completedTasks) || 0,
                sessions: Number(dayData.sessions) || 0
              };
            });
          } else {
            console.log('Firebase not available, using demo data');
            this.weeklyData = this.generateDemoData();
          }
          
          console.log('Weekly data loaded:', this.weeklyData);
        } catch (error) {
          console.error('Error loading weekly data:', error);
          this.weeklyData = this.generateDemoData();
        }
      }

      getLast7Days() {
        const dates = [];
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          dates.push(date.toISOString().split('T')[0]);
        }
        return dates;
      }

      generateDemoData() {
        const dates = this.getLast7Days();
        return dates.map(date => ({
          date,
          studyTime: Math.floor(Math.random() * 120) + 10,
          completedTasks: Math.floor(Math.random() * 5),
          sessions: Math.floor(Math.random() * 3) + 1
        }));
      }

      renderChart() {
        const ctx = document.getElementById('weeklyChart').getContext('2d');
        
        // Format labels to show day names
        const dayNames = this.weeklyData.map(item => {
          const date = new Date(item.date);
          return date.toLocaleDateString('id-ID', { weekday: 'short' });
        });
        
        // Destroy previous chart if exists
        if (this.chart) {
          this.chart.destroy();
        }
        
        this.chart = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: dayNames,
            datasets: [
              {
                label: 'Menit Belajar',
                data: this.weeklyData.map(item => item.studyTime),
                backgroundColor: 'rgba(79, 70, 229, 0.7)',
                borderColor: 'rgba(79, 70, 229, 1)',
                borderWidth: 1,
                yAxisID: 'y'
              },
              {
                label: 'Sesi Belajar',
                data: this.weeklyData.map(item => item.sessions),
                backgroundColor: 'rgba(16, 185, 129, 0.7)',
                borderColor: 'rgba(16, 185, 129, 1)',
                borderWidth: 1,
                type: 'line',
                yAxisID: 'y1'
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'top',
                labels: {
                  boxWidth: 12,
                  padding: 20
                }
              },
              tooltip: {
                mode: 'index',
                intersect: false
              }
            },
            scales: {
              y: {
                type: 'linear',
                display: true,
                position: 'left',
                title: {
                  display: true,
                  text: 'Menit Belajar'
                },
                grid: {
                  drawOnChartArea: true
                }
              },
              y1: {
                type: 'linear',
                display: true,
                position: 'right',
                title: {
                  display: true,
                  text: 'Jumlah Sesi'
                },
                grid: {
                  drawOnChartArea: false
                },
                min: 0
              }
            },
            interaction: {
              mode: 'nearest',
              axis: 'x',
              intersect: false
            }
          }
        });
      }

      setupResizeListener() {
        // Handle window resize for better mobile responsiveness
        let resizeTimeout;
        window.addEventListener('resize', () => {
          clearTimeout(resizeTimeout);
          resizeTimeout = setTimeout(() => {
            this.renderChart();
          }, 200);
        });
      }
    }

    // Initialize when DOM is loaded
    document.addEventListener('DOMContentLoaded', () => {
      window.weeklyStats = new WeeklyStats();
    });
