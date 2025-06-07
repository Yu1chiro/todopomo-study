require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const admin = require('firebase-admin');

// Inisialisasi Firebase Admin pakai ENV
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://goalstarget-99822-default-rtdb.firebaseio.com`,
});

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static folder langsung ke public
app.use(express.static(path.join(__dirname, 'public')));

// Middleware verifikasi session Firebase
const verifyToken = async (req, res, next) => {
  const sessionCookie = req.cookies.session || '';

  try {
    const decodedClaims = await admin.auth().verifySessionCookie(sessionCookie, true);
    req.user = decodedClaims;
    next();
  } catch (error) {
    res.redirect('/'); // Redirect ke index jika belum login
  }
};

// Rute dashboard untuk user yang sudah login
app.get('/dashboard', verifyToken, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'user.html'));
});
app.get('/statistic', verifyToken, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'statistic.html'));
});
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Endpoint login via session cookie
app.post('/sessionLogin', async (req, res) => {
  const idToken = req.body.idToken;
  const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 hari

  try {
    const sessionCookie = await admin.auth().createSessionCookie(idToken, { expiresIn });
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    // Pisahkan data profil dan data permanen
    const userRef = admin.database().ref(`users/${decodedToken.uid}`);
    
    // Cek apakah user sudah ada (untuk mempertahankan data yang ada)
    const userSnapshot = await userRef.once('value');
    const existingData = userSnapshot.val() || {};
    
    // Update hanya data profil, pertahankan folder data
    await userRef.update({
      profile: {
        name: decodedToken.name,
        email: decodedToken.email,
        picture: decodedToken.picture,
        lastLogin: new Date().toISOString(),
      },
      // Pertahankan data yang sudah ada (termasuk folder data)
      data: existingData.data || {}
    });

    res.cookie('session', sessionCookie, {
      maxAge: expiresIn,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    });

    res.status(200).json({ status: 'success' });
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

// Logout endpoint - hanya hapus data profil
app.get('/sessionLogout', async (req, res) => {
  try {
    const sessionCookie = req.cookies.session;
    
    if (sessionCookie) {
      // Verifikasi session cookie untuk mendapatkan UID
      const decodedClaims = await admin.auth().verifySessionCookie(sessionCookie);
      
      // Hapus hanya data profil, pertahankan folder data
      await admin.database().ref(`users/${decodedClaims.uid}/profile`).remove();
      
      // Atau jika ingin set status offline
      // await admin.database().ref(`users/${decodedClaims.uid}/profile/status`).set('offline');
    }
  } catch (error) {
    console.log('Error during logout:', error);
  }
  
  res.clearCookie('session');
  res.redirect('/');
});

// Alternative: Jika ingin struktur data berbeda
app.post('/sessionLoginAlt', async (req, res) => {
  const idToken = req.body.idToken;
  const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 hari

  try {
    const sessionCookie = await admin.auth().createSessionCookie(idToken, { expiresIn });
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    const userRef = admin.database().ref(`users/${decodedToken.uid}`);
    
    // Struktur: users/{uid}/session untuk data sementara
    //          users/{uid}/data untuk data permanen
    await userRef.child('session').set({
      name: decodedToken.name,
      email: decodedToken.email,
      picture: decodedToken.picture,
      lastLogin: new Date().toISOString(),
      isActive: true
    });

    res.cookie('session', sessionCookie, {
      maxAge: expiresIn,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    });

    res.status(200).json({ status: 'success' });
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

// Logout dengan struktur alternatif
app.get('/sessionLogoutAlt', async (req, res) => {
  try {
    const sessionCookie = req.cookies.session;
    
    if (sessionCookie) {
      const decodedClaims = await admin.auth().verifySessionCookie(sessionCookie);
      
      // Hapus hanya folder session, pertahankan folder data
      await admin.database().ref(`users/${decodedClaims.uid}/session`).remove();
    }
  } catch (error) {
    console.log('Error during logout:', error);
  }
  
  res.clearCookie('session');
  res.redirect('/');
});

// Fungsi helper untuk mengecek apakah user sedang login
async function checkUserSession(req, res, next) {
  try {
    const sessionCookie = req.cookies.session;
    
    if (!sessionCookie) {
      return res.status(401).json({ error: 'No session found' });
    }

    const decodedClaims = await admin.auth().verifySessionCookie(sessionCookie);
    req.user = decodedClaims;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid session' });
  }
}

// Contoh penggunaan untuk mengakses data user
app.get('/userData', checkUserSession, async (req, res) => {
  try {
    const userRef = admin.database().ref(`users/${req.user.uid}`);
    const snapshot = await userRef.once('value');
    const userData = snapshot.val();
    
    res.json({
      profile: userData.profile || userData.session, // Tergantung struktur yang dipilih
      data: userData.data || {}
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

// Endpoint ambil data user login
app.get('/user', verifyToken, async (req, res) => {
  try {
    const snapshot = await admin.database().ref(`users/${req.user.uid}`).once('value');
    res.json(snapshot.val());
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

// Jalankan server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
