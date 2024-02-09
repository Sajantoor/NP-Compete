import { Button, Flex, Heading, Input, Select, Stack, Tab, TabList, Tabs, Text } from "@chakra-ui/react";
import Editor from "@monaco-editor/react";
import monaco from 'monaco-editor';
import Router from "next/router"
import { useEffect, useRef, useState } from "react";
import NavBar from "../../components/navBar";
import { LEETCODE_API, SERVER_URL, WEBSOCKET_URL } from "../../constants";
import { WebSocketMessage } from "../../../server/src/types/WebSocketMessage";
import { Room as RoomType, QuestionResult } from "../../../server/src/types/Room";
import RenderedText from "../../components/renderedText";

const DEFAULT_LANGUAGE = "javascript";
const DEFAULT_CODE = "";

interface CodeState {
    code: string,
    language: string,
}

interface UserData extends CodeState {
    username: string,
}

// This is stored codeData for each possible language
interface CodeData {
    languageValue: string; // language slug
    languageName: string; // language name
    code: string; // default code
}

interface EditorState extends CodeState {
    currentlyViewingUser: string,
}

interface QuestionMetadata {
    title: string,
    title_slug: string,
    description: string,
    id: number,
}

export default function Room() {
    const inputRef = useRef<HTMLInputElement>(null);
    const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

    const [roomName, setRoomName] = useState<string>("");
    const [messages, setMessages] = useState<string[]>(["Welcome to the room!"]);
    const [websocket, setWebSocket] = useState<WebSocket | null>(null);
    const [editorState, setEditorState] = useState<EditorState>({
        code: DEFAULT_CODE,
        language: DEFAULT_LANGUAGE,
        currentlyViewingUser: "",
    });

    const [currentUsername, setCurrentUsername] = useState<string | null>(null);

    // TODO: This might be inefficent as it will cause many state changes, might be better not to use state for this
    const [users, setUsers] = useState<UserData[]>([]);
    const [lastSentCode, setLastSentCode] = useState<CodeState>({
        code: DEFAULT_CODE,
        language: DEFAULT_LANGUAGE,
    });

    const [currentQuestion, setCurrentQuestion] = useState<QuestionMetadata>({} as QuestionMetadata);
    // list of code per language for the current user
    const [userCode, setUserCode] = useState<CodeData[]>([]);

    /**
     * Get the room info from the server and update the user state with the members
     */
    useEffect(() => {
        async function fetchDataAndSetState() {
            const { uuid } = Router.query;
            if (!uuid) {
                return;
            }

            const roomResponse = await fetch(`${SERVER_URL}/api/v1/rooms/${uuid}`, {
                "method": "GET",
                "credentials": "include",
                "mode": "cors",
            });

            const userResponse = await fetch(`${SERVER_URL}/api/v1/profile`, {
                "method": "GET",
                "credentials": "include",
                "mode": "cors",
            });

            const userData = await userResponse.json();
            const roomData: RoomType = await roomResponse.json();
            const currentQuestion = roomData.questionData?.questionTitle;

            if (!currentQuestion) {
                // TODO: Handle this error
                return;
            }

            const currentQuestionResponse = await fetch(`${LEETCODE_API}/api/v1/leetcode/questions/${currentQuestion}`, {
                "method": "GET",
                "mode": "cors",
            });

            setRoomName(roomData.name);

            const currentQuestionData: QuestionResult = await currentQuestionResponse.json();

            setCurrentQuestion({
                title: currentQuestionData.metaData.name,
                title_slug: currentQuestion,
                description: currentQuestionData.content,
                id: roomData.questionData!.questionID,
            });

            // Set user's code for each language by using currentQuestionData.codeDefinition 
            const userCode: CodeData[] = [];
            for (const language of currentQuestionData.codeDefinition) {
                userCode.push({
                    languageValue: language.value,
                    languageName: language.text,
                    code: language.defaultCode,
                });
            }
            setUserCode(userCode);

            const username = userData.user.username;
            setCurrentUsername(username);

            const currentCode = userCode.find(code => code.languageValue === DEFAULT_LANGUAGE)?.code || DEFAULT_CODE;

            const currentUser: UserData = {
                username: username,
                code: currentCode,
                language: DEFAULT_LANGUAGE,
            };

            setUsers((users) => (
                [currentUser, ...users]
            ));

            setEditorState(({
                code: currentCode,
                language: DEFAULT_LANGUAGE,
                currentlyViewingUser: username,
            }));
        }

        fetchDataAndSetState();
    }, [])

    /**
     * Handle the websocket connection and websocket events
     */
    useEffect(() => {
        const { uuid } = Router.query;
        if (!uuid) {
            return;
        }

        const websocket = new WebSocket(`${WEBSOCKET_URL}/${uuid}`);

        websocket.onopen = () => { }
        websocket.onclose = () => {
            // TOOD: Might be better to show an error in the UI instead
            Router.push("/rooms");
        }

        setWebSocket(websocket);
        // On component unmount, close websocket
        return () => {
            websocket.close();
        }

    }, []);

    useEffect(() => {
        // Don't send the code if we are not viewing our own code and the code has not changed
        if (editorState.currentlyViewingUser === currentUsername &&
            (lastSentCode.code !== editorState.code || lastSentCode.language !== editorState.language)
        ) {
            sendCurrentCode();
        }

        // TODO: Remove this. 
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editorState])

    useEffect(() => {
        if (!websocket) return;

        websocket.onmessage = (event) => {
            handleMessage(event.data);
        }
    });

    function sendCurrentCode() {
        if (!websocket) {
            // TOOD: Show error in UI
            console.error("No websocket connection");
            return;
        }

        // TODO: Check for username here and update correctly
        const message = {
            event: "code",
            code: editorState.code,
            language: editorState.language
        }

        setLastSentCode({
            code: editorState.code,
            language: editorState.language,
        });

        websocket.send(JSON.stringify(message));
    }

    function handleCodeEvent(message: WebSocketMessage) {
        // Check if the user is currently being viewed, if so update the editor
        if (message.username === editorState.currentlyViewingUser) {
            setEditorState(prevState => ({
                currentlyViewingUser: prevState.currentlyViewingUser,
                code: message.code!,
                language: message.language!,
            }));
        }


        // The user's room users may have not populated yet, everyone is sending their code to that user
        // populate the user's room users with the corresponding code 
        setUsers(users => (
            // TODO: This code fucking sucks.
            // If the user exists already, then we simply update the user
            users.find(user => user.username === message.username) ?
                users.map(user => {
                    if (user.username === message.username) {
                        return {
                            ...user,
                            code: message.code!,
                            language: message.language!,
                        }
                    }
                    return user;
                })
                // Else we add it to the user
                : [...users, { username: message.username!, code: message.code!, language: message.language! }]
        ));
    }


    function handleUserJoinEvent(message: WebSocketMessage): string {
        setUsers(users => ([...users, { username: message.username!, code: DEFAULT_CODE, language: DEFAULT_LANGUAGE }]));
        // When a user joins, all other users should send their code to the new user
        sendCurrentCode();
        return `User ${message.username} joined`;
    }

    function handleUserLeaveEvent(message: WebSocketMessage) {
        setUsers(users => (users.filter(user => user.username !== message.username)));
        return `User ${message.username} left`;
    }

    function handleUserSubmitEvent(message: WebSocketMessage) {
        return `User ${message.username} submitted their code`;
    }

    function handleUserSubmitResultEvent(message: WebSocketMessage) {
        return `User ${message.username} submitted their code and got a result`;
    }

    /**
    * 
    * @param rawMessage 
    */
    function handleMessage(rawMessage: string) {
        const message: WebSocketMessage = JSON.parse(rawMessage);

        let newMessage: string | undefined | null;
        switch (message.event) {
            case "code":
                handleCodeEvent(message);
                break;
            case "userSubmit":
                newMessage = handleUserSubmitEvent(message);
                break;
            case "userSubmitResult":
                newMessage = handleUserSubmitResultEvent(message);
                break;
            case "userJoined":
                newMessage = handleUserJoinEvent(message);
                break;
            case "userLeft":
                newMessage = handleUserLeaveEvent(message);
                break;
            case "error":
                console.error("Error: ", message.message);
                break;
            case "message":
                newMessage = `${message.username}: ${message.message}`;
                break;
            default:
                console.error("Unknown event: ", message.event);
                break;
        }

        if (newMessage) {
            setMessages(messages => ([...messages, newMessage!]));
        }
    }

    function sendMessage() {
        const message = inputRef?.current?.value;
        if (!message) {
            return;
        }

        if (!websocket) {
            // TOOD: Show error in UI
            console.error("No websocket connection");
            return;
        }

        // Clear the input after sending the message
        inputRef.current.value = "";
        websocket.send(message);
    }

    function handleEditorChange(value: string | undefined, _event: monaco.editor.IModelContentChangedEvent) {
        if (!value) return;

        setEditorState(editorState => ({
            ...editorState,
            code: value,
        }));
    }

    function handleLanguageChange(e: React.FormEvent<HTMLDivElement>) {
        // save the user's current code for that language
        setUserCode(userCode => (
            userCode.map(code => {
                // If the language is the same as the current language, then update the code
                if (code.languageValue === editorState.language) {
                    return {
                        ...code,
                        code: editorState.code,
                    }
                }
                return code;
            }
            )
        ));

        // TODO: Fix this ts error 
        // @ts-ignore
        const language = e.target.value;
        // Get the code for the language or use the default code as a fallback
        const code = userCode.find(code => code.languageValue === language)?.code || DEFAULT_CODE;

        setEditorState(editorState => ({
            ...editorState,
            code: code,
            language: language,
        }));
    }

    function isViewingCurrentUser() {
        return (editorState.currentlyViewingUser === currentUsername);
    }

    function isWebSocketReady() {
        if (!websocket) return false;
        return websocket?.readyState === websocket.OPEN;
    }

    function switchUser(userStr: string) {
        // Don't switch if the user is already being viewed
        // TODO: Test with isViewingCurrentUser function instead 
        if (userStr === editorState.currentlyViewingUser) return;

        const user = users.find(user => user.username === userStr);
        if (!user) return;

        // save the user's current code 
        setUsers(users => (
            users.map(user => {
                if (user.username === currentUsername) {
                    return {
                        ...user,
                        code: editorState.code,
                        language: editorState.language,
                    }
                }
                return user;
            }
            )
        ));

        setEditorState({
            code: user.code,
            language: user.language,
            currentlyViewingUser: user.username,
        });

        editorRef.current?.updateOptions({
            readOnly: user.username !== currentUsername
        });
    }

    async function handleSubmitQuestion() {
        // Don't submit anything if we viewing someone else's code 
        if (!isViewingCurrentUser() || !isWebSocketReady()) {
            return;
        }

        // send websocket event to say we have submit the question
        const userSubmitMessage = {
            event: "userSubmit",
            question: {
                code: editorState.code,
                language: editorState.language,
            }
        }

        websocket!.send(JSON.stringify(userSubmitMessage));

        // Call LeetCode API to check if the code is correct
        const submissionRequestURL = `${LEETCODE_API}/api/v1/leetcode/questions/${currentQuestion.title_slug}/submit`;
        const requestBody = {
            question_id: currentQuestion.id.toString(),
            lang: editorState.language,
            typed_code: editorState.code,
        }

        const submissionResponse = await fetch(submissionRequestURL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
        });

        // Get the submission id and use it to get the submission result
        const submissionResult = await submissionResponse.json();
        const submissionId = submissionResult.submission_id;

        // Get the submission result 
        const requestURL = `${LEETCODE_API}/api/v1/leetcode/questions/submissions/${submissionId}`;
        const response = await fetch(requestURL);
        const result = await response.json();

        // TODO: Flesh this out a bit more in the future
        const resultMessage: WebSocketMessage = {
            event: "userSubmitResult",
            message: result.status_msg,
        }

        websocket!.send(JSON.stringify(resultMessage));
    }

    // @ts-ignore for some reason monaco is not being recognized
    function handleEditorMount(editor: monaco.editor.IStandaloneCodeEditor, monaco: typeof monaco) {
        editorRef.current = editor;
    }

    return (
        <>
            <NavBar>
                <Heading fontSize="xl"> {roomName} </Heading>
            </NavBar>

            <Flex direction="column" padding={5}>
                <Flex direction="row" mb={2}>
                </Flex>

                <Flex direction="row" mb={2}>
                    <Flex direction="row" minWidth="100%" height="100%">
                        <Flex bg="gray.800" p={5} direction="column" width="25%">
                            <Heading fontSize="xl" mb={5}> {currentQuestion.title} </Heading>
                            <RenderedText text={currentQuestion.description} />
                        </Flex>

                        <Flex bg="gray.800" p={5} direction="column" width="70%" padding={0}>
                            <Tabs variant='soft-rounded' mb={2}>
                                <TabList>
                                    {
                                        users.map((user, index) => {
                                            return <Tab key={index} onClick={() => {
                                                switchUser(user.username);
                                            }}> {user.username} </Tab>
                                        })
                                    }
                                </TabList>
                            </Tabs>
                            <Editor
                                theme="vs-dark"
                                width="100%"
                                height="83.5vh"
                                language={editorState.language}
                                defaultValue=""
                                onChange={handleEditorChange}
                                value={editorState.code}
                                onMount={handleEditorMount}
                            />

                            <Flex direction="row" justifyContent="flex-end" mt={2} padding={2} onChange={handleLanguageChange}>
                                <Select size="sm" >
                                    {
                                        // Render the language options fetched from API 
                                        userCode.map((code, index) => {
                                            return (
                                                <option key={index} value={code.languageValue}> {code.languageName} </option>
                                            )
                                        })
                                    }
                                </Select>
                                <Button size="sm" ml={2} onClick={handleSubmitQuestion}> Submit </Button>
                            </Flex>
                        </Flex>

                        <Flex bg="gray.800" p={5} direction="column" width="25%" alignSelf="flex-end">
                            <Heading fontSize="2xl" mb={5}> Messages </Heading>
                            <Flex direction="column" minHeight="70vh" justifyContent="flex-end" mb={2}>
                                <Stack mb={5}>
                                    {messages.map((message, index) => {
                                        return (
                                            <Text key={index}> {message} </Text>
                                        )
                                    })}
                                </Stack>

                                {/* move this flex to the bottom of the page */}
                                <Flex direction="row" >
                                    <Input mr={2} ref={inputRef} type="text" size="sm" />
                                    <Button onClick={sendMessage} size="sm"> Send </Button>
                                </Flex>
                            </Flex>
                        </Flex>
                    </Flex>
                </Flex>
            </Flex>
        </>
    )
}
