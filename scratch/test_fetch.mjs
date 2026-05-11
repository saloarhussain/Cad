fetch('https://tqedzihlvsmolhaduntg.supabase.co/rest/v1/', { headers: { 'apikey': 'any' } })
  .then(res => console.log('Fetch Status:', res.status))
  .catch(err => console.error('Fetch Error:', err.message));
