interface RequestContext {
    request: Request;
}

export function onRequest(context: RequestContext, next: () => Promise<Response>): Response | Promise<Response> {
    const { pathname } = new URL(context.request.url);

    // Handle static assets rewrite
    if (pathname.startsWith('/ingest/static/')) {
        const newUrl = pathname.replace(
            '/ingest/static/',
            'https://eu-assets.i.posthog.com/static/'
        );
        return Response.redirect(newUrl, 308);
    }

    // Handle API rewrite
    if (pathname.startsWith('/ingest/')) {
        const newUrl = pathname.replace(
            '/ingest/',
            'https://eu.i.posthog.com/'
        );
        return Response.redirect(newUrl, 308);
    }

    return next();
};