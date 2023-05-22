import { Button, Flex, Heading, Input, Select, Stack, Tab, TabList, Tabs, Text } from "@chakra-ui/react";
import Editor from "@monaco-editor/react";
import monaco from 'monaco-editor';
import Router from "next/router"
import { useEffect, useRef, useState } from "react";
import NavBar from "../../components/navBar";
import { LEETCODE_API, SERVER_URL, WEBSOCKET_URL } from "../../constants";

const DEFAULT_LANGUAGE = "javascript";
const DEFAULT_CODE = "";

interface WebSocketMessage {
    event: string, // userJoined, userLeft, message, error 
    message?: string // Only appears on error and message events
    username?: string // Only appears on userJoin, userLeft and message events
    code?: string // Only appears on code update events
    language?: string // Only appears on code update events
}

interface UserData {
    username: string,
    code: string,
    language: string,
}

interface EditorState extends CodeState {
    currentlyViewingUser: string,
}

interface CodeState {
    code: string,
    language: string,
}

interface QuestionData {
    title: string,
    description: string,
}

interface CodeData {
    value: string,
    language: string,
    code: string,
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

    const [currentQuestion, setCurrentQuestion] = useState<QuestionData>({} as QuestionData);
    // list of code per language for the current user
    const [userCode, setUserCode] = useState<CodeData[]>([]);

    /**
     * Get the room info from the server and update the user state with the members
     */
    useEffect(() => {
        const { uuid } = Router.query;
        if (!uuid) {
            return;
        }

        // make http request to get the room info 
        const roomData = fetch(`${SERVER_URL}/api/v1/rooms/${uuid}`, {
            "method": "GET",
            "credentials": "include",
            "mode": "cors",
        }).then(response => response.json());


        // Get the user's username from the server 
        const userData = fetch(`${SERVER_URL}/api/v1/profile`, {
            "method": "GET",
            "credentials": "include",
            "mode": "cors",
        }).then(response => response.json());


        roomData.then((roomData) => {
            const currentQuestion = roomData.question;
            setRoomName(roomData.name);

            // TODO: For now get a random question, later we will actually use the currentQuestion field lmao 
            const currentQuestionData = fetch(`${LEETCODE_API}/api/v1/leetcode/questions/random`, {
                "method": "GET",
                "mode": "cors"
            }).then(response => response.json());

            currentQuestionData.then((currentQuestionData) => {
                const questionTitle = currentQuestionData.metaData.name;
                const questionDescription = currentQuestionData.content;
                const codeData = currentQuestionData.codeDefinition;

                setCurrentQuestion({
                    title: questionTitle,
                    description: questionDescription,
                });

                setUserCode(codeData);
            });
        });

        userData.then((userData) => {
            const username = userData.user.username;
            setCurrentUsername(username);

            const currentUser: UserData = {
                username: username,
                code: DEFAULT_CODE,
                language: DEFAULT_LANGUAGE,
            };

            setUsers((users) => (
                [currentUser, ...users]
            ));

            setEditorState(({
                code: DEFAULT_CODE,
                language: DEFAULT_LANGUAGE,
                currentlyViewingUser: username,
            }));
        });
    }, []);

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
        if (editorState.currentlyViewingUser === currentUsername && (lastSentCode.code !== editorState.code || lastSentCode.language !== editorState.language)) {
            sendCurrentCode();
        }

        // TODO: Remove this. 
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editorState])

    useEffect(() => {
        if (!websocket) return;

        websocket.onmessage = (event) => {
            processMessage(event.data);
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

    /**
    * 
    * @param rawMessage 
    */
    function processMessage(rawMessage: string) {
        const message: WebSocketMessage = JSON.parse(rawMessage);

        let newMessage: string | undefined | null;
        switch (message.event) {
            case "userJoined":
                newMessage = `User ${message.username} joined`;
                setUsers(users => ([...users, { username: message.username!, code: DEFAULT_CODE, language: DEFAULT_LANGUAGE }]));

                // When a user joins, all other users should send their code to the new user
                sendCurrentCode();
                break;
            case "userLeft":
                newMessage = `User ${message.username} left`;
                setUsers(users => (users.filter(user => user.username !== message.username)));
                break;
            case "error":
                console.error("Error: ", message.message);
                break;
            case "message":
                newMessage = `${message.username}: ${message.message}`;
                break;
            case "code":
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

                newMessage = null;
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
                if (code.language === editorState.language) {
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
        const code = userCode.find(code => code.language === language)?.code || DEFAULT_CODE;

        setEditorState(editorState => ({
            ...editorState,
            code: code,
            language: language,
        }));
    }

    function switchUser(userStr: string) {
        // Don't switch if the user is already being viewed
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
                            <Text>
                                {currentQuestion.description}
                            </Text>
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
                                <Select size="sm" placeholder={editorState.language}>
                                    <option value="javascript">JavaScript</option>
                                    <option value="typescript">TypeScript</option>
                                    <option value="java">Java</option>
                                    <option value="cpp">C++</option>
                                </Select>
                                <Button size="sm" ml={2}> Submit </Button>
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
