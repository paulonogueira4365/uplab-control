
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	export interface AppTypes {
		RouteId(): "/" | "/alterar-senha" | "/historico" | "/notificacoes" | "/requisicao" | "/solicitacoes-agendadas";
		RouteParams(): {
			
		};
		LayoutParams(): {
			"/": Record<string, never>;
			"/alterar-senha": Record<string, never>;
			"/historico": Record<string, never>;
			"/notificacoes": Record<string, never>;
			"/requisicao": Record<string, never>;
			"/solicitacoes-agendadas": Record<string, never>
		};
		Pathname(): "/" | "/alterar-senha" | "/alterar-senha/" | "/historico" | "/historico/" | "/notificacoes" | "/notificacoes/" | "/requisicao" | "/requisicao/" | "/solicitacoes-agendadas" | "/solicitacoes-agendadas/";
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): "/logo-uplab.jpg" | "/robots.txt" | "/UPLAB.png" | string & {};
	}
}