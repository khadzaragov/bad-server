const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
}

const htmlEscapeRegex = /[&<>"']/g

export default function escapeHtml(value: string): string {
    return value.replace(htmlEscapeRegex, (char) => htmlEscapes[char])
}
