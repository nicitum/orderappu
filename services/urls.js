const environments = {
  dev: "147.93.110.150",
  home: "147.93.110.150",
  work: "147.93.110.150"
};

const selectedEnvironment = "dev"; 

export const ipAddress = environments[selectedEnvironment];
