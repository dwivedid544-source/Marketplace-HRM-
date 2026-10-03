import React, { useEffect, useState } from 'react';
import { Joyride, STATUS } from 'react-joyride';

const TourGuide = ({ run, setRun }) => {
  const [steps] = useState([
    {
      target: '#tour-dashboard-nav',
      content: 'Welcome to your Admin Dashboard! Here you can get a quick overview of your company metrics.',
      disableBeacon: true,
    },
    {
      target: '#tour-employees-nav',
      content: 'Add, edit, or remove employees from your company here. You can set their roles and details.',
    },
    {
      target: '#tour-attendance-nav',
      content: 'Track daily attendance, view punch-in/out times, and manually correct missing records.',
    },
    {
      target: '#tour-face-register-nav',
      content: 'Register employee faces for secure, AI-powered biometric attendance tracking.',
    },
    {
      target: '#tour-payroll-nav',
      content: 'Process salaries, generate payslips, and view payment histories efficiently.',
    },
    {
      target: '#tour-settings-nav',
      content: 'Configure company details, set up geolocation fences, and more.',
    },
    {
      target: '#tour-help-button',
      content: 'Need a refresher? Click here anytime to restart this guided tour!',
    }
  ]);

  const handleJoyrideCallback = (data) => {
    const { status } = data;
    const finishedStatuses = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      setRun(false);
      localStorage.setItem('nexus_tour_completed', 'true');
    }
  };

  return (
    <Joyride
      callback={handleJoyrideCallback}
      continuous
      hideCloseButton
      run={run}
      scrollToFirstStep
      showProgress
      showSkipButton
      steps={steps}
      styles={{
        options: {
          zIndex: 10000,
          primaryColor: '#2563EB',
          textColor: '#0f172a',
          backgroundColor: '#ffffff',
          arrowColor: '#ffffff',
        },
        tooltipContainer: {
          textAlign: 'left',
          fontSize: '13px',
          fontWeight: '500'
        },
        buttonNext: {
          backgroundColor: '#2563EB',
          fontSize: '12px',
          fontWeight: 'bold',
          padding: '8px 16px',
          borderRadius: '8px',
        },
        buttonBack: {
          marginRight: 10,
          color: '#64748b',
          fontSize: '12px',
          fontWeight: 'bold',
        },
        buttonSkip: {
          color: '#64748b',
          fontSize: '12px',
          fontWeight: 'bold',
        }
      }}
    />
  );
};

export default TourGuide;
