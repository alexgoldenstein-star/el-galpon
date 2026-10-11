// Configuración de Firebase del proyecto El Galpón.
// Estos datos son públicos por diseño: la seguridad la dan las reglas de Firestore y Storage.
window.GALPON_FIREBASE = {
  apiKey: "AIzaSyCb-26EHIIgUu-v3HqLqwFct4FwUjg8iTg",
  authDomain: "el-galpon-b3cac.firebaseapp.com",
  projectId: "el-galpon-b3cac",
  storageBucket: "el-galpon-b3cac.firebasestorage.app",
  messagingSenderId: "584434783940",
  appId: "1:584434783940:web:0dcab3fcfef1e50fac9b91"
};

// Mails que pueden entrar al panel de administrador (en minúsculas).
// IMPORTANTE: si agregás o sacás un mail acá, hacé lo mismo en firestore.rules y storage.rules.
window.GALPON_ADMINS = [
  "alexgoldenstein@hotmail.com"
];
