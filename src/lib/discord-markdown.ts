// Renders message text the way Discord formats it, for dashboard previews. Covers the markdown
// Discord supports in messages (headings, subtext, quotes, lists, code, bold, italics, underline,
// strikethrough, spoilers, masked links) and mention syntax. Returns HTML with all text escaped.

export type DiscordMarkdownOptions = {
	// Names to show for <@id> and <#id>; unknown ids fall back to what Discord shows for them.
	users?: Record<string, string>;
	channels?: Record<string, string>;
};

type Inline = (text: string, options: DiscordMarkdownOptions) => string;
type Rule = {
	match: RegExp;
	render: (groups: RegExpExecArray, inline: Inline) => string;
	// Only applies when the previous character is not a letter or digit, like _italics_.
	wordStart?: boolean;
};

const ESCAPES: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#39;'
};

function escape(text: string): string {
	return text.replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

function link(url: string, label: string): string {
	return `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
}

function mention(text: string, kind = 'mention'): string {
	return `<span class="${kind}">${escape(text)}</span>`;
}

const CODE_BLOCK = /^```(?:([\w+-]+)\n)?\n?([\s\S]*?)\n?```/;

function codeBlock(match: RegExpExecArray): string {
	return `<pre><code>${escape(match[2])}</code></pre>`;
}

// Tried in order at each position; the first match wins, so longer markers come first.
function inlineRules(options: DiscordMarkdownOptions): Rule[] {
	return [
		{ match: /^\\([^0-9A-Za-z\s])/, render: (m) => escape(m[1]) },
		{ match: CODE_BLOCK, render: codeBlock },
		{ match: /^(``?)([\s\S]*?[^`])\1(?!`)/, render: (m) => `<code>${escape(m[2].trim())}</code>` },
		{
			match: /^\|\|([\s\S]+?)\|\|/,
			render: (m, inline) => `<span class="spoiler">${inline(m[1], options)}</span>`
		},
		{
			match: /^\*\*([\s\S]+?)\*\*(?!\*)/,
			render: (m, inline) => `<strong>${inline(m[1], options)}</strong>`
		},
		{ match: /^__([\s\S]+?)__(?!_)/, render: (m, inline) => `<u>${inline(m[1], options)}</u>` },
		{
			match: /^\*(?=\S)((?:\*\*[\s\S]+?\*\*|\\[\s\S]|[^\\*])+?)\*(?!\*)/,
			render: (m, inline) => `<em>${inline(m[1], options)}</em>`
		},
		{
			match: /^_((?:__|\\[\s\S]|[^\\_])+?)_(?![A-Za-z0-9_])/,
			render: (m, inline) => `<em>${inline(m[1], options)}</em>`,
			wordStart: true
		},
		{ match: /^~~([\s\S]+?)~~/, render: (m, inline) => `<s>${inline(m[1], options)}</s>` },
		{
			match: /^\[([^\][]+)\]\(<?(https?:\/\/[^\s)>]+)>?\)/,
			render: (m, inline) => link(m[2], inline(m[1], options))
		},
		{ match: /^<(https?:\/\/[^\s>]+)>/, render: (m) => link(m[1], escape(m[1])) },
		{ match: /^https?:\/\/[^\s<]+[^\s<.,:;"')\]!?]/, render: (m) => link(m[0], escape(m[0])) },
		{
			match: /^<@!?(\w+)>/,
			render: (m) => mention(`@${options.users?.[m[1]] ?? 'unknown-user'}`)
		},
		{ match: /^<@&(\d+)>/, render: () => mention('@unknown-role') },
		{
			match: /^<#(\d+)>/,
			render: (m) => mention(`#${options.channels?.[m[1]] ?? 'unknown'}`)
		},
		{ match: /^<a?(:\w+:)\d+>/, render: (m) => escape(m[1]) },
		{ match: /^<t:(-?\d+)(?::[tTdDfFR])?>/, render: (m) => mention(timestamp(m[1]), 'timestamp') },
		{ match: /^\n/, render: () => '<br>' },
		// Plain text runs up to the next character that could start another rule.
		{ match: /^[\s\S][^\\`|*_~[<h\n]*/, render: (m) => escape(m[0]) }
	];
}

function timestamp(seconds: string): string {
	const date = new Date(Number(seconds) * 1000);
	return Number.isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleString();
}

function inline(text: string, options: DiscordMarkdownOptions): string {
	const rules = inlineRules(options);
	let html = '';
	let rest = text;
	while (rest) {
		const afterWord = /[A-Za-z0-9]$/.test(text.slice(0, text.length - rest.length));
		for (const rule of rules) {
			if (rule.wordStart && afterWord) continue;
			const match = rule.match.exec(rest);
			if (!match) continue;
			html += rule.render(match, inline);
			rest = rest.slice(match[0].length);
			break;
		}
	}
	return html;
}

const HEADING = /^(#{1,3}) (.+)$/;
const SUBTEXT = /^-# (.+)$/;
const QUOTE = /^> ?(.*)$/;
const LIST_ITEM = /^( *)(?:([-*])|(\d{1,9})\.) (.+)$/;

// Block markdown only counts at the start of a line, and code blocks keep their contents as is.
function blocks(text: string, options: DiscordMarkdownOptions): string {
	const lines = text.split('\n');
	let html = '';
	let paragraph: string[] = [];
	const flush = () => {
		if (paragraph.length) html += `<p>${inline(paragraph.join('\n'), options)}</p>`;
		paragraph = [];
	};

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		if (line.startsWith('```')) {
			const code = CODE_BLOCK.exec(lines.slice(i).join('\n'));
			if (code) {
				flush();
				html += codeBlock(code);
				// Anything after the closing fence carries on as normal text.
				const after = lines.slice(i).join('\n').slice(code[0].length).split('\n');
				if (after[0] === '') after.shift();
				lines.splice(i, lines.length - i, ...after);
				i--;
				continue;
			}
		}

		if (line.startsWith('>>> ')) {
			flush();
			html += `<blockquote>${blocks([line.slice(4), ...lines.slice(i + 1)].join('\n'), options)}</blockquote>`;
			return html;
		}

		const quote = QUOTE.exec(line);
		if (quote) {
			flush();
			const quoted = [quote[1]];
			while (i + 1 < lines.length && QUOTE.test(lines[i + 1]) && !lines[i + 1].startsWith('>>> ')) {
				quoted.push(QUOTE.exec(lines[++i])![1]);
			}
			html += `<blockquote>${blocks(quoted.join('\n'), options)}</blockquote>`;
			continue;
		}

		const heading = HEADING.exec(line);
		if (heading) {
			flush();
			const level = heading[1].length;
			html += `<h${level}>${inline(heading[2], options)}</h${level}>`;
			continue;
		}

		const subtext = SUBTEXT.exec(line);
		if (subtext) {
			flush();
			html += `<small>${inline(subtext[1], options)}</small>`;
			continue;
		}

		const item = LIST_ITEM.exec(line);
		if (item) {
			flush();
			const ordered = item[3] !== undefined;
			const tag = ordered ? 'ol' : 'ul';
			html += ordered ? `<ol start="${Number(item[3])}">` : '<ul>';
			let current: RegExpExecArray | null = item;
			while (current) {
				const depth = Math.min(Math.floor(current[1].length / 2), 3);
				html += `<li style="margin-left: ${depth * 1.25}rem">${inline(current[4], options)}</li>`;
				const next = i + 1 < lines.length ? LIST_ITEM.exec(lines[i + 1]) : null;
				if (!next || (next[3] !== undefined) !== ordered) break;
				current = next;
				i++;
			}
			html += `</${tag}>`;
			continue;
		}

		paragraph.push(line);
	}
	flush();
	return html;
}

// Backslashes markdown characters so text, like a name filled into a template, shows as typed.
export function escapeDiscordMarkdown(text: string): string {
	return text
		.replace(/[\\*_~`|[]/g, '\\$&')
		.replace(/^([#>-])/gm, '\\$1')
		.replace(/^(\d+)\./gm, '$1\\.');
}

export function renderDiscordMarkdown(text: string, options: DiscordMarkdownOptions = {}): string {
	return blocks(text, options);
}
