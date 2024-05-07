import { Box, Button, Card, Heading, Text } from "@chakra-ui/react";
import NavBar from "./components/navBar";

export default function Home() {
    return (
        <>
            <NavBar />
            <Box padding={5}>
                <Heading fontSize="4xl" padding={1}>
                    NP Compete
                </Heading>
                <Text fontSize="l" padding={1}>
                    A platform for <em>competing</em> against others in
                    programming challenges.
                </Text>
            </Box>
        </>
    );
}
