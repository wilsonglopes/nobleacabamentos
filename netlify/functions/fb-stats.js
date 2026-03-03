// Node 18+ has built-in fetch, no need for node-fetch dependency

exports.handler = async (event, context) => {
    const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;
    const FB_PIXEL_ID = process.env.FB_PIXEL_ID;

    if (!FB_ACCESS_TOKEN || !FB_PIXEL_ID) {
        return {
            statusCode: 200,
            body: JSON.stringify({
                error: "Missing FB_ACCESS_TOKEN or FB_PIXEL_ID in environment variables.",
                events_today: 0,
                purchases_today: 0,
                connected: false
            }),
        };
    }

    try {
        // Get stats for today
        const now = new Date();
        const today = now.toISOString().split('T')[0];

        // Facebook Graph API call to pixel stats
        // We fetch daily stats for the pixel
        const url = `https://graph.facebook.com/v18.0/${FB_PIXEL_ID}/stats?access_token=${FB_ACCESS_TOKEN}&aggregation=event&start_time=${today}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message);
        }

        // Process events
        let eventsToday = 0;
        let purchasesToday = 0;

        if (data.data && data.data.length > 0) {
            data.data.forEach(stat => {
                eventsToday += stat.count || 0;
                if (stat.event === 'Purchase') {
                    purchasesToday += stat.count || 0;
                }
            });
        }

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                events_today: eventsToday,
                purchases_today: purchasesToday,
                connected: true
            }),
        };
    } catch (error) {
        console.error("Facebook API Error:", error);
        return {
            statusCode: 200, // Return 200 to avoid breaking UI, let body handle error
            body: JSON.stringify({
                error: error.message,
                events_today: 0,
                purchases_today: 0,
                connected: false
            }),
        };
    }
};
