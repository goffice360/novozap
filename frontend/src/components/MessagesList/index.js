import React, { useState, useEffect, useReducer, useRef } from "react";

import { isSameDay, parseISO, format } from "date-fns";
import openSocket from "socket.io-client";
import clsx from "clsx";

import { green } from "@material-ui/core/colors";
import {
	Button,
	CircularProgress,
	Divider,
	IconButton,
	makeStyles,
} from "@material-ui/core";
import {
	AccessTime,
	Block,
	Done,
	DoneAll,
	ExpandMore,
	GetApp,
} from "@material-ui/icons";

import LinkifyWithTargetBlank from "../LinkifyWithTargetBlank";
import ModalImageCors from "../ModalImageCors";
import MessageOptionsMenu from "../MessageOptionsMenu";
import whatsBackground from "../../assets/wa-background.png";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import { toast } from "react-toastify";

const useStyles = makeStyles(theme => ({
	messagesListWrapper: {
		overflow: "hidden",
		position: "relative",
		display: "flex",
		flexDirection: "column",
		flexGrow: 1,
	},

	messagesList: {
		backgroundImage: `url(${whatsBackground})`,
		display: "flex",
		flexDirection: "column",
		flexGrow: 1,
		padding: "20px 20px 20px 20px",
		overflowY: "scroll",
		...theme.scrollbarStyles,
	},

	circleLoading: {
		color: green[500],
		position: "absolute",
		opacity: "70%",
		top: 0,
		left: "50%",
		marginTop: 12,
	},

	messageLeft: {
		marginRight: 20,
		marginTop: 2,
		minWidth: 100,
		maxWidth: 600,
		height: "auto",
		display: "block",
		position: "relative",

		whiteSpace: "pre-wrap",
		backgroundColor: "#ffffff",
		color: "#303030",
		alignSelf: "flex-start",
		borderTopLeftRadius: 0,
		borderTopRightRadius: 8,
		borderBottomLeftRadius: 8,
		borderBottomRightRadius: 8,
		paddingLeft: 5,
		paddingRight: 5,
		paddingTop: 5,
		paddingBottom: 0,
		boxShadow: "0 1px 1px #b3b3b3",
	},

	messageRight: {
		marginLeft: 20,
		marginTop: 2,
		minWidth: 100,
		maxWidth: 600,
		height: "auto",
		display: "block",
		position: "relative",

		"&:hover #messageActionsButton": {
			display: "flex",
			position: "absolute",
			top: 0,
			right: 0,
		},

		whiteSpace: "pre-wrap",
		backgroundColor: "#dcf8c6",
		color: "#303030",
		alignSelf: "flex-end",
		borderTopLeftRadius: 8,
		borderTopRightRadius: 8,
		borderBottomLeftRadius: 8,
		borderBottomRightRadius: 0,
		paddingLeft: 5,
		paddingRight: 5,
		paddingTop: 5,
		paddingBottom: 0,
		boxShadow: "0 1px 1px #b3b3b3",
	},

	messageActionsButton: {
		display: "none",
		position: "relative",
		color: "#999",
		zIndex: 1,
		backgroundColor: "#dcf8c6",
		"&:hover, &.Mui-focusVisible": { backgroundColor: "#dcf8c6" },
	},

	messageContactName: {
		display: "flex",
		paddingLeft: 6,
		color: "#6bcbef",
		fontWeight: 500,
	},

	textContentItem: {
		overflowWrap: "break-word",
		padding: "3px 80px 6px 6px",
	},

	textContentItemDeleted: {
		fontStyle: "italic",
		color: "rgba(0, 0, 0, 0.36)",
		overflowWrap: "break-word",
		padding: "3px 80px 6px 6px",
	},

	messageMedia: {
		objectFit: "cover",
		width: 250,
		height: 200,
		borderTopLeftRadius: 8,
		borderTopRightRadius: 8,
		borderBottomLeftRadius: 8,
		borderBottomRightRadius: 8,
	},

	timestamp: {
		fontSize: 11,
		position: "absolute",
		bottom: 0,
		right: 5,
		color: "#999",
	},

	dailyTimestamp: {
		alignItems: "center",
		textAlign: "center",
		alignSelf: "center",
		width: "110px",
		backgroundColor: "#e1f3fb",
		margin: "10px",
		borderRadius: "10px",
		boxShadow: "0 1px 1px #b3b3b3",
	},

	dailyTimestampText: {
		color: "#808888",
		padding: 8,
		alignSelf: "center",
		marginLeft: "0px",
	},

	ackIcons: {
		fontSize: 18,
		verticalAlign: "middle",
		marginLeft: 4,
	},

	deletedIcon: {
		fontSize: 18,
		verticalAlign: "middle",
		marginRight: 4,
	},

	ackDoneAllIcon: {
		color: green[500],
		fontSize: 18,
		verticalAlign: "middle",
		marginLeft: 4,
	},

	downloadMedia: {
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "inherit",
		padding: 10,
	},
}));

const reducer = (state, action) => {
	if (action.type === "LOAD_MESSAGES") {
		const messages = action.payload;
		const newMessages = [];

		messages.forEach(message => {
			const messageIndex = state.findIndex(m => m.id === message.id);
			if (messageIndex !== -1) {
				state[messageIndex] = message;
			} else {
				newMessages.push(message);
			}
		});

		return [...newMessages, ...state];
	}

	if (action.type === "ADD_MESSAGE") {
		const newMessage = action.payload;
		const messageIndex = state.findIndex(m => m.id === newMessage.id);

		if (messageIndex !== -1) {
			state[messageIndex] = newMessage;
		} else {
			state.push(newMessage);
		}

		return [...state];
	}

	if (action.type === "UPDATE_MESSAGE") {
		const messageToUpdate = action.payload;
		const messageIndex = state.findIndex(m => m.id === messageToUpdate.id);

		if (messageIndex !== -1) {
			state[messageIndex] = messageToUpdate;
		}

		return [...state];
	}

	if (action.type === "RESET") {
		return [];
	}
};

const MessagesList = ({ ticketId, isGroup }) => {
	const classes = useStyles();

	const [messagesList, dispatch] = useReducer(reducer, []);
	const [pageNumber, setPageNumber] = useState(1);
	const [hasMore, setHasMore] = useState(false);
	const [loading, setLoading] = useState(false);
	const lastMessageRef = useRef();

	const [selectedMessageId, setSelectedMessageId] = useState(null);
	const [anchorEl, setAnchorEl] = useState(null);
	const messageOptionsMenuOpen = Boolean(anchorEl);

	useEffect(() => {
		dispatch({ type: "RESET" });
		setPageNumber(1);
	}, [ticketId]);

	useEffect(() => {
		setLoading(true);
		const delayDebounceFn = setTimeout(() => {
			const fetchMessages = async () => {
				try {
					const { data } = await api.get("/messages/" + ticketId, {
						params: { pageNumber },
					});

					dispatch({ type: "LOAD_MESSAGES", payload: data.messages });
					setHasMore(data.hasMore);

					if (pageNumber === 1 && data.messages.length > 1) {
						scrollToBottom();
					}
				} catch (err) {
					const errorMsg = err.response?.data?.error;
					if (errorMsg) {
						if (i18n.exists(`backendErrors.${errorMsg}`)) {
							toast.error(i18n.t(`backendErrors.${errorMsg}`));
						} else {
							toast.error(err.response.data.error);
						}
					} else {
						toast.error("Unknown error");
					}
				}
			};

			setLoading(false);
			fetchMessages();
		}, 500);
		return () => clearTimeout(delayDebounceFn);
	}, [pageNumber, ticketId]);

	useEffect(() => {
		const socket = openSocket(process.env.REACT_APP_BACKEND_URL);
		socket.emit("joinChatBox", ticketId);

		socket.on("appMessage", data => {
			if (data.action === "create") {
				dispatch({ type: "ADD_MESSAGE", payload: data.message });
				scrollToBottom();
			}

			if (data.action === "update") {
				dispatch({ type: "UPDATE_MESSAGE", payload: data.message });
			}
		});

		return () => {
			socket.disconnect();
		};
	}, [ticketId]);

	const loadMore = () => {
		setPageNumber(prevPageNumber => prevPageNumber + 1);
	};

	const scrollToBottom = () => {
		if (lastMessageRef.current) {
			lastMessageRef.current.scrollIntoView({});
		}
	};

	const handleScroll = e => {
		if (!hasMore) return;
		const { scrollTop } = e.currentTarget;

		if (scrollTop === 0) {
			document.getElementById("messagesList").scrollTop = 1;
		}

		if (loading) {
			return;
		}

		if (scrollTop < 50) {
			loadMore();
		}
	};

	const handleOpenMessageOptionsMenu = (e, messageId) => {
		setAnchorEl(e.currentTarget);
		setSelectedMessageId(messageId);
	};

	const handleCloseMessageOptionsMenu = e => {
		setAnchorEl(null);
	};

	const checkMessageMedia = message => {
		if (message.mediaType === "image") {
			return <ModalImageCors imageUrl={message.mediaUrl} />;
		}
		if (message.mediaType === "audio") {
			return (
				<audio controls>
					<source src={message.mediaUrl} type="audio/ogg"></source>
				</audio>
			);
		}

		if (message.mediaType === "video") {
			return (
				<video
					className={classes.messageMedia}
					src={message.mediaUrl}
					controls
				/>
			);
		} else {
			return (
				<>
					<div className={classes.downloadMedia}>
						<Button
							startIcon={<GetApp />}
							color="primary"
							variant="outlined"
							target="_blank"
							href={message.mediaUrl}
						>
							Download
						</Button>
					</div>
					<Divider />
				</>
			);
		}
	};

	const renderMessageAck = message => {
		if (message.ack === 0) {
			return <AccessTime fontSize="small" className={classes.ackIcons} />;
		}
		if (message.ack === 1) {
			return <Done fontSize="small" className={classes.ackIcons} />;
		}
		if (message.ack === 2) {
			return <DoneAll fontSize="small" className={classes.ackIcons} />;
		}
		if (message.ack === 3) {
			return <DoneAll fontSize="small" className={classes.ackDoneAllIcon} />;
		}
	};

	const renderDailyTimestamps = (message, index) => {
		if (index === 0) {
			return (
				<span
					className={classes.dailyTimestamp}
					key={`timestamp-${message.id}`}
				>
					<div className={classes.dailyTimestampText}>
						{format(parseISO(messagesList[index].createdAt), "dd/MM/yyyy")}
					</div>
				</span>
			);
		}
		if (index < messagesList.length - 1) {
			let messageDay = parseISO(messagesList[index].createdAt);
			let previousMessageDay = parseISO(messagesList[index - 1].createdAt);

			if (!isSameDay(messageDay, previousMessageDay)) {
				return (
					<span
						className={classes.dailyTimestamp}
						key={`timestamp-${message.id}`}
					>
						<div className={classes.dailyTimestampText}>
							{format(parseISO(messagesList[index].createdAt), "dd/MM/yyyy")}
						</div>
					</span>
				);
			}
		}
		if (index === messagesList.length - 1) {
			return (
				<div
					key={`ref-${message.createdAt}`}
					ref={lastMessageRef}
					style={{ float: "left", clear: "both" }}
				/>
			);
		}
	};

	const renderMessageDivider = (message, index) => {
		if (index < messagesList.length && index > 0) {
			let messageUser = messagesList[index].fromMe;
			let previousMessageUser = messagesList[index - 1].fromMe;

			if (messageUser !== previousMessageUser) {
				return (
					<span style={{ marginTop: 16 }} key={`divider-${message.id}`}></span>
				);
			}
		}
	};

	const renderMessages = () => {
		if (messagesList.length > 0) {
			const viewMessagesList = messagesList.map((message, index) => {
				if (!message.fromMe) {
					return (
						<LinkifyWithTargetBlank key={message.id}>
							{renderDailyTimestamps(message, index)}
							{renderMessageDivider(message, index)}
							<div className={classes.messageLeft}>
								{isGroup && (
									<span className={classes.messageContactName}>
										{message.contact?.name}
									</span>
								)}
								{message.mediaUrl && checkMessageMedia(message)}
								<div className={classes.textContentItem}>
									{message.body}
									<span className={classes.timestamp}>
										{format(parseISO(message.createdAt), "HH:mm")}
									</span>
								</div>
							</div>
						</LinkifyWithTargetBlank>
					);
				} else {
					return (
						<LinkifyWithTargetBlank key={message.id}>
							{renderDailyTimestamps(message, index)}
							{renderMessageDivider(message, index)}
							<div className={classes.messageRight}>
								<IconButton
									variant="contained"
									size="small"
									id="messageActionsButton"
									disabled={message.isDeleted}
									className={classes.messageActionsButton}
									onClick={e => handleOpenMessageOptionsMenu(e, message.id)}
								>
									<ExpandMore />
								</IconButton>
								{message.mediaUrl && checkMessageMedia(message)}
								<div
									className={clsx(classes.textContentItem, {
										[classes.textContentItemDeleted]: message.isDeleted,
									})}
								>
									{message.isDeleted && (
										<Block
											color="disabled"
											fontSize="small"
											className={classes.deletedIcon}
										/>
									)}
									{message.body}
									<span className={classes.timestamp}>
										{format(parseISO(message.createdAt), "HH:mm")}
										{renderMessageAck(message)}
									</span>
								</div>
							</div>
						</LinkifyWithTargetBlank>
					);
				}
			});
			return viewMessagesList;
		} else {
			return <div>Say hello to your new contact!</div>;
		}
	};

	return (
		<div className={classes.messagesListWrapper}>
			<MessageOptionsMenu
				messageId={selectedMessageId}
				anchorEl={anchorEl}
				menuOpen={messageOptionsMenuOpen}
				handleClose={handleCloseMessageOptionsMenu}
			/>
			<div
				id="messagesList"
				className={classes.messagesList}
				onScroll={handleScroll}
			>
				{messagesList.length > 0 ? renderMessages() : []}
			</div>
			{loading && (
				<div>
					<CircularProgress className={classes.circleLoading} />
				</div>
			)}
		</div>
	);
};

export default MessagesList;
