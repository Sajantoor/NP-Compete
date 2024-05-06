import React from 'react';

interface RenderedTextProps {
    text: string;
}


export default function RenderedText(props: RenderedTextProps) {
    // TODO: This is a temporary solution to render the text as HTML, a better 
    // solution would be to use a parser, as this can be dangerous. 
    return (
        <div dangerouslySetInnerHTML={{ __html: props.text }}></div>
    );
}

