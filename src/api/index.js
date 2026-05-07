const API_BASE = '/api';

export const fetchRides = async (type = 'all') => {
  const res = await fetch(`${API_BASE}/rides?type=${type}`);
  if (!res.ok) throw new Error('Failed to fetch rides');
  return await res.json();
};

export const postRide = async (data) => {
  const res = await fetch(`${API_BASE}/rides`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to post ride');
  return await res.json();
};

export const deleteRide = async (id, userId = null) => {
  let url = `${API_BASE}/rides?id=${id}`;
  if (userId) url += `&user_id=${userId}`;
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete ride');
  return await res.json();
};

export const getSystemConfig = async () => {
  const res = await fetch(`${API_BASE}/admin?action=get_config`);
  if (!res.ok) throw new Error('Failed to fetch config');
  return await res.json();
};
