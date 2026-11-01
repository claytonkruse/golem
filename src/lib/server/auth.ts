import { redirect } from '@sveltejs/kit';

// Call from every dashboard load, not only the layout: SvelteKit runs a page's load in
// parallel with its layout's, so a guard in the layout alone does not protect the page.
export function requireSession(locals: App.Locals): NonNullable<App.Locals['session']> {
	if (!locals.session) redirect(303, '/auth/login/');
	return locals.session;
}
