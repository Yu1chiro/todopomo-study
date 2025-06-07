// Initialize Firebase
const firebaseConfig = {
  apiKey: "AIzaSyD1vMiNamv8wlRSXwAUsB2-TArUREB4kKc",
  authDomain: "goalstarget-99822.firebaseapp.com",
  projectId: "goalstarget-99822",
  storageBucket: "goalstarget-99822.appspot.com",
  messagingSenderId: "812894502748",
  appId: "1:812894502748:web:b491be7b1e8cfff24f8b99",
  measurementId: "G-XNTQV9G2VM"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// Google Sign-In
document.addEventListener('DOMContentLoaded', () => {
  const googleSignInBtn = document.getElementById('googleSignIn');
  const errorMessage = document.getElementById('errorMessage');
  
  if (googleSignInBtn) {
    googleSignInBtn.addEventListener('click', () => {
      const provider = new firebase.auth.GoogleAuthProvider();
      auth.signInWithPopup(provider)
        .then((result) => {
          // Send token to server to create session cookie
          return result.user.getIdToken().then(idToken => {
            return fetch('/sessionLogin', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ idToken }),
              credentials: 'same-origin'
            });
          });
        })
        .then(response => {
          if (!response.ok) throw new Error('Login failed');
          return response.json();
        })
        .then(data => {
          if (data.status === 'success') {
            window.location.href = '/dashboard';
          }
        })
        .catch(error => {
          console.error('Error:', error);
          errorMessage.textContent = error.message;
          errorMessage.classList.remove('hidden');
        });
    });
  }
});