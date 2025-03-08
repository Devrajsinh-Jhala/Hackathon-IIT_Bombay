// components/HelpChatbot.tsx
import { useState, useEffect, useRef } from "react";
import {
  Button,
  Popover,
  Card,
  TextField,
  Typography,
  Box,
  CircularProgress,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import IconButton from "@mui/material/IconButton";

export default function HelpChatbot({ onClose }: any) {
  const [messages, setMessages] = useState<
    Array<{ text: string; sender: "user" | "bot" }>
  >([
    {
      text: "Hello! I'm your compliance assistant. How can I help you today?",
      sender: "bot",
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    // Add user message
    const userMessage = { text: inputValue, sender: "user" };
    setMessages((prev: any) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      // Call the simplified API endpoint
      const response = await fetch("/api/help-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.text,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Add bot response
        setMessages((prev) => [
          ...prev,
          { text: data.response, sender: "bot" },
        ]);
      } else {
        throw new Error(data.error || "Unknown error");
      }
    } catch (error) {
      console.error("Error getting response:", error);
      setMessages((prev) => [
        ...prev,
        {
          text: "Sorry, I'm having trouble responding right now. Please try again later.",
          sender: "bot",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card
      sx={{
        width: 350,
        height: 500,
        position: "fixed",
        bottom: 16,
        right: 16,
        zIndex: 1200,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box
        sx={{
          p: 2,
          bgcolor: "primary.main",
          color: "white",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Typography variant="h6">Compliance Help</Typography>
        <IconButton color="inherit" onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Box>

      <Box sx={{ p: 2, flexGrow: 1, overflow: "auto", maxHeight: 350 }}>
        {messages.map((msg, index) => (
          <Box
            key={index}
            sx={{
              p: 1,
              mb: 1,
              bgcolor: msg.sender === "user" ? "grey.100" : "primary.light",
              color: msg.sender === "user" ? "text.primary" : "white",
              borderRadius: 1,
              maxWidth: "80%",
              ml: msg.sender === "user" ? "auto" : 0,
              mr: msg.sender === "bot" ? "auto" : 0,
            }}
          >
            <Typography variant="body2">{msg.text}</Typography>
          </Box>
        ))}
        <div ref={messagesEndRef} />
        {isLoading && (
          <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}
      </Box>

      <Box
        sx={{
          p: 2,
          borderTop: "1px solid",
          borderColor: "divider",
          display: "flex",
        }}
      >
        <TextField
          fullWidth
          size="small"
          placeholder="Ask a compliance question..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && handleSend()}
          sx={{ mr: 1 }}
        />
        <Button variant="contained" onClick={handleSend}>
          Send
        </Button>
      </Box>
    </Card>
  );
}
