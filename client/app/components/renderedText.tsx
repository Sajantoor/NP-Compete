import { Box } from "@chakra-ui/react";
import React from "react";
import parse from "html-react-parser";
import "../../styles/renderedText.css";

interface RenderedTextProps {
    text: string;
}

// add these css properties
/* 
pre {
  white-space: pre-wrap;    
}
*/

export default function RenderedText(props: RenderedTextProps) {
    if (!props.text || props.text.length === 0) return null;

    return (
        <Box className="renderedText" m={1}>
            {parse(props.text)}
        </Box>
    );
}
