const { query } = require("../config/db");

const {
  get_admin_reporting_overview_service,
  get_admin_usage_report_service,
  get_admin_quality_report_service,
  get_admin_compliance_report_service,
  get_admin_security_report_service,
} = require("../services/16-admin-reporting_service");

function isClientError(error) {
  const message = String(error?.message || "").toLowerCase();

  return (
    message.includes("valid report date") ||
    message.includes("start date") ||
    message.includes("maximum of 366 days")
  );
}

function respondWithError(res, error) {
  const status = isClientError(error) ? 400 : 500;

  return res.status(status).json({
    success: false,
    error: true,
    message:
      error?.message ||
      "Unable to retrieve the admin report.",
    status,
  });
}

const get_admin_reporting_overview_controller = async (
  req,
  res,
) => {
  try {
    const result =
      await get_admin_reporting_overview_service(
        query,
        req.query,
      );

    return res.status(200).json({
      ...result,
      status: 200,
    });
  } catch (error) {
    return respondWithError(res, error);
  }
};

const get_admin_usage_report_controller = async (
  req,
  res,
) => {
  try {
    const result = await get_admin_usage_report_service(
      query,
      req.query,
    );

    return res.status(200).json({
      ...result,
      status: 200,
    });
  } catch (error) {
    return respondWithError(res, error);
  }
};

const get_admin_quality_report_controller = async (
  req,
  res,
) => {
  try {
    const result = await get_admin_quality_report_service(
      query,
      req.query,
    );

    return res.status(200).json({
      ...result,
      status: 200,
    });
  } catch (error) {
    return respondWithError(res, error);
  }
};

const get_admin_compliance_report_controller = async (
  req,
  res,
) => {
  try {
    const result =
      await get_admin_compliance_report_service(
        query,
        req.query,
      );

    return res.status(200).json({
      ...result,
      status: 200,
    });
  } catch (error) {
    return respondWithError(res, error);
  }
};

const get_admin_security_report_controller = async (
  req,
  res,
) => {
  try {
    const result = await get_admin_security_report_service(
      query,
      req.query,
    );

    return res.status(200).json({
      ...result,
      status: 200,
    });
  } catch (error) {
    return respondWithError(res, error);
  }
};

module.exports = {
  get_admin_reporting_overview_controller,
  get_admin_usage_report_controller,
  get_admin_quality_report_controller,
  get_admin_compliance_report_controller,
  get_admin_security_report_controller,
};