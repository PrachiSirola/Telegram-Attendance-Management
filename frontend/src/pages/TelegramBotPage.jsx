import { useSelector } from 'react-redux';
import { Box } from '@mui/material';
import PageHeader from '../components/PageHeader';
import TelegramBotSettingsCard from '../components/TelegramBotSettingsCard';

export default function TelegramBotPage() {
  const admin = useSelector((s) => s.auth.admin);
  const isSuperAdmin = admin?.role === 'super_admin';

  return (
    <Box>
      <PageHeader
        title="Telegram Bot"
        subtitle={
          isSuperAdmin
            ? 'Get a live activity feed across every organization on this platform'
            : "Get a live activity feed for your own organization's punch-ins, breaks, and leave activity"
        }
      />
      <TelegramBotSettingsCard
        description={
          isSuperAdmin
            ? "Configure the bot token and Chat ID to receive real-time activity and updates from the organization(s)."
            : "Create a bot via @BotFather, add it to your own chat, and paste the details below. You'll get a live feed of punch-ins, breaks, and leave activity for your organization only."
        }
      />
    </Box>
  );
}