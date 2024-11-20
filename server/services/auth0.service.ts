import { ManagementClient } from 'auth0';

const auth0 = new ManagementClient({
  domain: process.env.AUTH0_DOMAIN!,
  clientId: process.env.AUTH0_MANAGEMENT_CLIENT_ID!,
  clientSecret: process.env.AUTH0_MANAGEMENT_CLIENT_SECRET!,
});

interface Auth0UserData {
  connection: string;
  email?: string;
  phone_number?: string;
  password: string;
  verify_email: boolean;
}

function generateStrongPassword(): string {
  const length = 16;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+';
  let password = '';
  
  // Ensure at least one uppercase, one lowercase, one number, and one special char
  password += 'A1a!';
  
  // Add random characters
  for (let i = password.length; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

async function listConnections() {
  try {
    const connections = await auth0.connections.getAll();
    console.log('Available connections:', connections);
    return connections;
  } catch (error) {
    console.error('Error fetching connections:', error);
    throw error;
  }
}

export async function createAuth0User(email?: string, phone?: string) {
  // List available connections first
  const connections = await listConnections();
  
  // Default to Username-Password-Authentication as fallback
  const connection = 'Username-Password-Authentication';
  
  const userData: Auth0UserData = {
    connection,
    password: generateStrongPassword(),
    verify_email: false,
  };

  if (email) userData.email = email;
  if (phone) userData.phone_number = phone;

  try {
    const user = await auth0.users.create(userData);
    return user.data.user_id || user.data.id;
  } catch (error) {
    console.error('Error creating Auth0 user:', error);
    throw error;
  }
}