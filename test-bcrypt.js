import bcrypt from 'bcryptjs';
console.log(bcrypt.genSaltSync ? 'Works' : 'Fails');
