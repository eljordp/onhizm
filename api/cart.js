export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { variantId, quantity = 1 } = req.body;

  if (!variantId) {
    return res.status(400).json({ error: 'variantId is required' });
  }

  const SHOP = process.env.SHOPIFY_SHOP;
  const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
  const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;

  try {
    // Get access token via OAuth client credentials
    const tokenRes = await fetch(`https://${SHOP}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'client_credentials',
      }),
    });

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      console.error('Token error:', tokenData);
      return res.status(500).json({ error: 'Failed to get access token' });
    }

    // Create cart via Storefront API
    const gid = variantId.startsWith('gid://')
      ? variantId
      : `gid://shopify/ProductVariant/${variantId}`;

    const cartRes = await fetch(`https://${SHOP}/api/2024-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': accessToken,
      },
      body: JSON.stringify({
        query: `
          mutation cartCreate($input: CartInput!) {
            cartCreate(input: $input) {
              cart {
                checkoutUrl
              }
              userErrors {
                field
                message
              }
            }
          }
        `,
        variables: {
          input: {
            lines: [{ merchandiseId: gid, quantity }],
          },
        },
      }),
    });

    const cartData = await cartRes.json();
    const errors = cartData?.data?.cartCreate?.userErrors;

    if (errors && errors.length > 0) {
      return res.status(400).json({ error: errors[0].message });
    }

    const checkoutUrl = cartData?.data?.cartCreate?.cart?.checkoutUrl;

    if (!checkoutUrl) {
      console.error('Cart error:', JSON.stringify(cartData));
      return res.status(500).json({ error: 'Failed to create cart' });
    }

    return res.status(200).json({ checkoutUrl });
  } catch (err) {
    console.error('Cart handler error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
